import {test,expect} from 'bun:test';
import {scopeLocationReviews} from './locationReviewScope';
test('location reviews apply both project and exact location restrictions',()=>{
  expect(scopeLocationReviews('Florida',['5049','5049'])).toEqual({projectId:'Florida',locationIds:['5049']});
});