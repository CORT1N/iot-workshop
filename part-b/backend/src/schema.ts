import { z } from 'zod';

export const telemetrySchema = z.object({
  type: z.literal('telemetry'),
  node_id: z.string().min(1),
  temp: z.number(),
  humidity: z.number(),
  rssi: z.number(),
  timestamp: z.number(),
});
