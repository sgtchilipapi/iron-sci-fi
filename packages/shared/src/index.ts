export type HealthcheckResponse = {
  status: string;
};

export function healthcheckPayload(status: string): HealthcheckResponse {
  return { status };
}
