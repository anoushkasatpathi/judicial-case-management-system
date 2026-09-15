import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EmergencyWorkflowStatus, NotificationChannel } from '@prisma/client';
import { AuditService } from './audit.service.js';
import { HearingService } from './hearing.service.js';
import { PriorityService } from './priority.service.js';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class EmergencyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly hearings: HearingService,
    private readonly priority: PriorityService,
  ) {}

  async start(caseId: string, actorId: string, reason = 'Emergency petition submitted') {
    const current = await this.getCase(caseId);
    if (current.is_emergency || current.emergency_status) throw new ConflictException('Case is already in the emergency workflow');
    const updated = await this.prisma.case.update({
      where: { id: caseId },
      data: { is_emergency: true, emergency_status: EmergencyWorkflowStatus.FiledEmergency },
    });
    await this.audit.append(caseId, 'EMERGENCY_WORKFLOW_STARTED', { is_emergency: false, emergency_status: null }, { is_emergency: true, emergency_status: updated.emergency_status }, actorId, reason);
    return this.priority.recomputeCase(caseId, actorId, reason);
  }

  async triage(caseId: string, actorId: string, reason = 'Registrar triage completed') {
    const current = await this.getCase(caseId);
    this.assertTransition(current.emergency_status, EmergencyWorkflowStatus.RegistrarTriage);
    const updated = await this.prisma.case.update({ where: { id: caseId }, data: { emergency_status: EmergencyWorkflowStatus.RegistrarTriage } });
    await this.auditTransition(caseId, current.emergency_status, updated.emergency_status ?? EmergencyWorkflowStatus.RegistrarTriage, actorId, reason, 'EMERGENCY_TRIAGED');
    return updated;
  }

  async accept(caseId: string, actorId: string, reason = 'Judge accepted emergency petition') {
    const current = await this.getCase(caseId);
    this.assertTransition(current.emergency_status, EmergencyWorkflowStatus.JudgeAcceptance);
    const updated = await this.prisma.case.update({ where: { id: caseId }, data: { emergency_status: EmergencyWorkflowStatus.JudgeAcceptance } });
    await this.auditTransition(caseId, current.emergency_status, updated.emergency_status ?? EmergencyWorkflowStatus.JudgeAcceptance, actorId, reason, 'EMERGENCY_ACCEPTED');
    return updated;
  }

  async injectSlot(caseId: string, actorId: string, reason = 'Emergency slot injected') {
    const current = await this.getCase(caseId);
    this.assertTransition(current.emergency_status, EmergencyWorkflowStatus.SlotInjection);
    const hearing = await this.hearings.createEmergencySlot(caseId);
    await this.priority.promoteCase(current.court_id, caseId, actorId, reason);
    const updated = await this.prisma.case.update({ where: { id: caseId }, data: { emergency_status: EmergencyWorkflowStatus.SlotInjection } });
    await this.audit.append(caseId, 'EMERGENCY_SLOT_INJECTED', { emergency_status: current.emergency_status }, { emergency_status: updated.emergency_status, hearing_id: hearing.id, scheduled_at: hearing.scheduled_at.toISOString() }, actorId, reason);
    return { case: updated, hearing };
  }

  async notify(caseId: string, actorId: string, reason = 'Emergency notification fan-out completed') {
    const current = await this.getCase(caseId);
    this.assertTransition(current.emergency_status, EmergencyWorkflowStatus.NotificationFanout);
    const fullCase = await this.prisma.case.findUniqueOrThrow({
      where: { id: caseId },
      include: { filing_advocate: true, assigned_judge: { include: { user: true } } },
    });
    const registrars = await this.prisma.user.findMany({ where: { role: 'Registrar' }, select: { id: true } });
    const recipientIds = [...new Set([
      fullCase.filing_advocate_id,
      fullCase.assigned_judge?.user_id,
      ...registrars.map((registrar) => registrar.id),
    ].filter((id): id is string => Boolean(id)))];

    // This synchronous write is the natural hook for BullMQ and email/SMS channels later.
    const notifications = await this.prisma.notification.createMany({
      data: recipientIds.map((userId) => ({
        user_id: userId,
        case_id: caseId,
        type: 'EmergencyPetition',
        channel: NotificationChannel.Push,
        sent_at: new Date(),
      })),
    });
    const updated = await this.prisma.case.update({ where: { id: caseId }, data: { emergency_status: EmergencyWorkflowStatus.NotificationFanout } });
    await this.audit.append(caseId, 'EMERGENCY_NOTIFICATION_FANOUT', { emergency_status: current.emergency_status }, { emergency_status: updated.emergency_status, recipient_count: notifications.count }, actorId, reason);
    return { case: updated, recipientCount: notifications.count };
  }

  private async getCase(caseId: string) {
    const item = await this.prisma.case.findUnique({ where: { id: caseId } });
    if (!item) throw new NotFoundException('Case not found');
    return item;
  }

  private assertTransition(current: EmergencyWorkflowStatus | null, next: EmergencyWorkflowStatus) {
    const expected: Record<EmergencyWorkflowStatus, EmergencyWorkflowStatus | null> = {
      FiledEmergency: EmergencyWorkflowStatus.RegistrarTriage,
      RegistrarTriage: EmergencyWorkflowStatus.JudgeAcceptance,
      JudgeAcceptance: EmergencyWorkflowStatus.SlotInjection,
      SlotInjection: EmergencyWorkflowStatus.NotificationFanout,
      NotificationFanout: null,
    };
    if (expected[current ?? EmergencyWorkflowStatus.NotificationFanout] !== next) {
      throw new ConflictException(`Invalid emergency transition: ${current ?? 'None'} -> ${next}`);
    }
  }

  private auditTransition(caseId: string, before: EmergencyWorkflowStatus | null, after: EmergencyWorkflowStatus, actorId: string, reason: string, action: string) {
    return this.audit.append(caseId, action, { emergency_status: before }, { emergency_status: after }, actorId, reason);
  }
}