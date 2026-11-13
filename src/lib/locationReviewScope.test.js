import {test,expect} from 'bun:test';
import {scopeLocationReviews} from './locationReviewScope';
test('location reviews apply both project and exact location restrictions',()=>{
  const calls=[];
  const query={eq(k,v){calls.push([k,v]);return this;},in(k,v){calls.push([k,v]);return this;}};
  scopeLocationReviews(query,'Florida',['5049']);
  expect(calls).toEqual([['project_id','Florida'],['location_id',['5049']]]);
});