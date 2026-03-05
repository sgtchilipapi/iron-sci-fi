import { healthcheckPayload } from '../src';

describe('healthcheckPayload', () => {
  it('returns normalized payload', () => {
    expect(healthcheckPayload('ok')).toEqual({ status: 'ok' });
  });
});
