import type { RecordItem } from './model.ts';
export const materialQuantityTolerance = (quantity:number) => Math.abs(quantity) * Number.EPSILON * 8;
export function materialFulfilment(records: RecordItem[], request: RecordItem) {
  const linked = records.filter(r => r.data.requestId === request.id);
  const review = linked.find(r => r.kind === 'workforce.material-review');
  const order = linked.find(r => r.kind === 'workforce.material-order');
  const deliveries = linked.filter(r => r.kind === 'workforce.material-delivery');
  const received = deliveries.reduce((sum,r) => sum + r.data.acceptedQuantity, 0);
  const damaged = deliveries.reduce((sum,r) => sum + r.data.damagedQuantity, 0);
  const difference = request.data.quantity - received;
  const remaining = difference > materialQuantityTolerance(request.data.quantity) ? difference : 0;
  const status = !review ? 'Awaiting review' : review.data.decision !== 'approved' ? 'Rejected' : !order ? 'Approved — awaiting order' : remaining === 0 ? 'Received in full' : deliveries.length ? 'Part delivered — balance outstanding' : 'Ordered — awaiting delivery';
  return {review,order,deliveries,received,damaged,remaining,status,latestId:deliveries.at(-1)?.id || order?.id || null};
}
