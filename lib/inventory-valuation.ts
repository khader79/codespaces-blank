export interface CostLayer {
  quantity: number;
  unitCost: number;
}

export function weightedAverageCost(layers: CostLayer[]): number {
  const quantity = layers.reduce((sum, layer) => sum + Math.max(0, layer.quantity), 0);
  if (quantity === 0) return 0;
  return layers.reduce((sum, layer) => sum + Math.max(0, layer.quantity) * Math.max(0, layer.unitCost), 0) / quantity;
}

export function consumeFifo(layers: CostLayer[], quantity: number): { cost: number; remaining: CostLayer[] } {
  let remainingToConsume = Math.max(0, quantity);
  let cost = 0;
  const remaining: CostLayer[] = [];
  for (const layer of layers) {
    const available = Math.max(0, layer.quantity);
    const consumed = Math.min(available, remainingToConsume);
    cost += consumed * Math.max(0, layer.unitCost);
    remainingToConsume -= consumed;
    if (available > consumed) remaining.push({ quantity: available - consumed, unitCost: layer.unitCost });
  }
  if (remainingToConsume > 0) throw new Error("Insufficient inventory cost layers.");
  return { cost: Math.round(cost * 100) / 100, remaining };
}