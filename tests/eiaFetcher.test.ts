import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { getCrudeInventoryChange, getCrudeProduction, getLatest } from '../src/data/fetchers/eiaFetcher.js';

vi.mock('axios');

describe('eiaFetcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches crude inventory change', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: { response: { data: [{ value: -1500 }] } }
    });
    const change = await getCrudeInventoryChange();
    expect(change).toBe(-1500);
    expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('api.eia.gov'), expect.any(Object));
  });

  it('fetches crude production', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: { response: { data: [{ value: 13200 }] } }
    });
    const prod = await getCrudeProduction();
    expect(prod).toBe(13200);
    expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('api.eia.gov'), expect.any(Object));
  });

  it('gets all latest values', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: { response: { data: [{ value: 10 }] } }
    });
    const latest = await getLatest();
    expect(latest).toHaveProperty('crude_inventory_change');
    expect(latest).toHaveProperty('crude_production');
    expect(latest).not.toHaveProperty('crude_oil_price'); // Ensure spot prices are removed
    expect(latest).not.toHaveProperty('nat_gas_price');
  });
});
