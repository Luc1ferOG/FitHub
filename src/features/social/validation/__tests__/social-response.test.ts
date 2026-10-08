import { friendshipResponse, publicUserResponse, profileResponse } from '../social-response';

it('rejects unsupported friendship states and malformed public aggregates', () => {
  expect(friendshipResponse.safeParse({ id:'r',requester_id:'a',addressee_id:'b',status:'blocked',created_at:'now' }).success).toBe(false);
  expect(profileResponse.safeParse({ profile:{},public_workout_count:-1,achievement_count:0,achievements:[] }).success).toBe(false);
});
it('strips private fields at the adapter boundary', () => {
  const result = publicUserResponse.parse({ id:'a',username:'alice',display_name:'Alice',avatar_url:null,bio:null,experience_level:'beginner',email:'private@example.test',weight_kg:80 });
  expect(result).not.toHaveProperty('email'); expect(result).not.toHaveProperty('weight_kg');
});
