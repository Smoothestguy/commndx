export function scopeLocationReviews(projectId:string,locationIds:string[]) {
  return {projectId,locationIds:[...new Set(locationIds)]};
}