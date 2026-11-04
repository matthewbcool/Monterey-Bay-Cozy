/** Deliberate reference heights, not measured visitors or population averages. */
export const VISITORS = [
  {height:1.82, x:-.44, z:.16, yaw:.12, build:1.04, pose:'rest', backpack:false},
  {height:1.68, x:-.33, z:.04, yaw:-.18, build:1.06, pose:'hip', backpack:true},
  {height:1.20, x:-.28, z:.08, yaw:-.16, build:1, pose:'point', backpack:false},
  {height:1.80, x:-.20, z:-.10, yaw:.10, build:.97, pose:'rest', backpack:false},
  {height:1.58, x:-.09, z:.26, yaw:.30, build:1.08, pose:'fold', backpack:false},
  {height:1.85, x:.07, z:-.08, yaw:-.12, build:1, pose:'rest', backpack:true},
  {height:1.30, x:.17, z:.14, yaw:.16, build:1, pose:'point', backpack:false},
  {height:1.72, x:.30, z:.04, yaw:-.24, build:1.04, pose:'fold', backpack:false},
  {height:1.65, x:.43, z:.20, yaw:.18, build:.96, pose:'hip', backpack:false},
] as const;
export type VisitorDefinition = typeof VISITORS[number];
export const VISITOR_BUDGET = {triangles:2800, drawCalls:1} as const;
