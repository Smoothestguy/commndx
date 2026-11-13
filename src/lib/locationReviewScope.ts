export function scopeLocationReviews<T extends {eq:(key:string,value:string)=>T;in:(key:string,values:string[])=>T}>(query:T,projectId:string,locationIds:string[]):T {
  return query.eq('project_id',projectId).in('location_id',locationIds);
}