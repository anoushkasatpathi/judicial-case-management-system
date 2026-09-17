import http from 'k6/http';
import { check, sleep } from 'k6';

const baseUrl = __ENV.BASE_URL || 'http://localhost:3000';
const courtId = __ENV.COURT_ID;
const email = __ENV.EMAIL || 'registrar@justiq.local';
const password = __ENV.PASSWORD || 'JustiQ-Dev-Password-2026';

export const options = {
  scenarios: { queue_read: { executor: 'constant-vus', vus: 5, duration: '30s' } },
  thresholds: { http_req_failed: ['rate<0.01'], http_req_duration: ['p(95)<500'] },
};

export function setup() {
  if (!courtId) throw new Error('COURT_ID is required');
  const response = http.post(`${baseUrl}/api/auth/login`, JSON.stringify({ email, password }), { headers: { 'Content-Type': 'application/json' } });
  check(response, { 'login succeeds': (item) => item.status === 201 || item.status === 200 });
  return { token: response.json('accessToken') };
}

export default function (data) {
  const params = { headers: { Authorization: `Bearer ${data.token}` } };
  const queue = http.get(`${baseUrl}/api/courts/${courtId}/queue`, params);
  const listing = http.get(`${baseUrl}/api/cases?court=${courtId}&limit=50`, params);
  check(queue, { 'priority queue succeeds': (item) => item.status === 200 });
  check(listing, { 'case listing succeeds': (item) => item.status === 200 });
  sleep(0.2);
}