import { leaderboardResponse } from '../leaderboard-response';
const row = { user_id:'93000000-0000-0000-0000-000000000001',display_name:'Mark',username:'mark',avatar_url:null,value:13,rank:2 };
const page = { title:'Challenge',metric:'workout_count',target:20,version:'1',participant_count:1,sharing:null,me:row,podium:[row],entries:[row] };
it('accepts authoritative tied ranks and rejects malformed or unbounded pages',()=> {
  expect(leaderboardResponse.safeParse({ ...page,podium:[row,{ ...row,user_id:'93000000-0000-0000-0000-000000000002' }] }).success).toBe(true);
  for (const changes of [{ entries:Array(22).fill(row) },{ target:0 },{ version:'' },{ entries:[{ ...row,rank:0 }] },{ entries:[{ ...row,value:Infinity }] }]) expect(leaderboardResponse.safeParse({ ...page,...changes }).success).toBe(false);
});
it('drops private fields from public leaderboard identities',()=> {
  const result = leaderboardResponse.parse({ ...page,entries:[{ ...row,email:'private@example.test',weight_kg:80 }] });
  expect(result.entries[0]).not.toHaveProperty('email'); expect(result.entries[0]).not.toHaveProperty('weight_kg');
});
