import { slots } from "./slots.js";

const slotIndexes = new Map(
  slots.map(({ value }, index) => [value, index]),
);
const slotLabels = new Map(
  slots.map(({ value, label }) => [value, label]),
);

export function buildChartPoints(readings) {
  return readings
    .map((reading) => {
      const dayOfMonth = Number(reading.date.split("-")[2]);
      const slotIndex = slotIndexes.get(reading.slot);

      return {
        x: dayOfMonth + slotIndex / 4,
        date: reading.date,
        slot: reading.slot,
        slotLabel: reading.slotLabel ?? slotLabels.get(reading.slot),
        value: reading.value,
      };
    })
    .sort((first, second) => first.x - second.x);
}
