begin;

insert into public.exercises (
  id, name, description, primary_muscle, secondary_muscles, equipment, difficulty, instructions
)
values
  (
    '10000000-0000-0000-0000-000000000001', 'Back Squat',
    'A compound lower-body movement performed with a barbell across the upper back.',
    'quadriceps', array['glutes', 'hamstrings', 'core'], 'barbell', 'intermediate',
    array['Set the bar across the upper back and brace the trunk.', 'Sit the hips down while tracking the knees over the toes.', 'Descend under control, then drive through the whole foot to stand.']
  ),
  (
    '10000000-0000-0000-0000-000000000002', 'Conventional Deadlift',
    'A hip-hinge movement that lifts a barbell from the floor.',
    'hamstrings', array['glutes', 'lower back', 'forearms'], 'barbell', 'advanced',
    array['Stand with the midfoot under the bar and hinge to grip it.', 'Brace the torso and pull the slack out of the bar.', 'Push the floor away and finish tall without leaning back.']
  ),
  (
    '10000000-0000-0000-0000-000000000003', 'Barbell Bench Press',
    'A horizontal pressing exercise performed on a flat bench.',
    'chest', array['triceps', 'front deltoids'], 'barbell', 'intermediate',
    array['Plant the feet and retract the shoulder blades.', 'Lower the bar to the lower chest with controlled elbows.', 'Press the bar upward while keeping the upper back tight.']
  ),
  (
    '10000000-0000-0000-0000-000000000004', 'Standing Overhead Press',
    'A standing vertical press using a barbell.',
    'shoulders', array['triceps', 'upper chest', 'core'], 'barbell', 'intermediate',
    array['Hold the bar at shoulder height and brace the trunk.', 'Press overhead while moving the head slightly back.', 'Finish with the bar stacked over the shoulders and hips.']
  ),
  (
    '10000000-0000-0000-0000-000000000005', 'Pull-Up',
    'A bodyweight vertical pulling movement.',
    'latissimus dorsi', array['biceps', 'upper back', 'forearms'], 'pull-up bar', 'intermediate',
    array['Hang from the bar with shoulders engaged.', 'Pull the chest toward the bar by driving the elbows down.', 'Lower to a controlled full hang.']
  ),
  (
    '10000000-0000-0000-0000-000000000006', 'Push-Up',
    'A bodyweight horizontal pressing movement.',
    'chest', array['triceps', 'front deltoids', 'core'], 'bodyweight', 'beginner',
    array['Start in a straight-arm plank with hands below the shoulders.', 'Lower the chest while keeping the body in one line.', 'Press the floor away to return to the start.']
  ),
  (
    '10000000-0000-0000-0000-000000000007', 'Bent-Over Barbell Row',
    'A free-weight horizontal pull performed from a hinged position.',
    'upper back', array['latissimus dorsi', 'biceps', 'rear deltoids'], 'barbell', 'intermediate',
    array['Hinge at the hips with a neutral spine.', 'Pull the bar toward the lower ribs.', 'Lower the bar without losing the torso position.']
  ),
  (
    '10000000-0000-0000-0000-000000000008', 'Forward Lunge',
    'A unilateral lower-body exercise using a forward step.',
    'quadriceps', array['glutes', 'hamstrings', 'calves'], 'bodyweight', 'beginner',
    array['Stand tall and take a controlled step forward.', 'Lower until both knees are comfortably bent.', 'Push through the front foot to return to standing.']
  ),
  (
    '10000000-0000-0000-0000-000000000009', 'Front Plank',
    'An isometric exercise for trunk stability.',
    'core', array['shoulders', 'glutes'], 'bodyweight', 'beginner',
    array['Place the elbows below the shoulders.', 'Create a straight line from the head to the heels.', 'Brace and breathe without allowing the hips to sag.']
  ),
  (
    '10000000-0000-0000-0000-000000000010', 'Dumbbell Biceps Curl',
    'An elbow-flexion exercise performed with dumbbells.',
    'biceps', array['forearms'], 'dumbbells', 'beginner',
    array['Stand tall with the dumbbells by the sides.', 'Curl without swinging the upper arms forward.', 'Lower the weights under control.']
  ),
  (
    '10000000-0000-0000-0000-000000000011', 'Cable Triceps Pushdown',
    'A cable isolation exercise for elbow extension.',
    'triceps', array[]::text[], 'cable machine', 'beginner',
    array['Pin the elbows beside the torso.', 'Extend the elbows until the arms are straight.', 'Return slowly without allowing the elbows to drift forward.']
  ),
  (
    '10000000-0000-0000-0000-000000000012', 'Leg Press',
    'A machine-based compound lower-body press.',
    'quadriceps', array['glutes', 'hamstrings'], 'leg press machine', 'beginner',
    array['Place the feet securely on the platform.', 'Lower the platform while keeping the lower back supported.', 'Press through the feet without locking the knees forcefully.']
  ),
  (
    '10000000-0000-0000-0000-000000000013', 'Lying Leg Curl',
    'A machine isolation exercise for knee flexion.',
    'hamstrings', array['calves'], 'leg curl machine', 'beginner',
    array['Align the machine pivot with the knees.', 'Curl the pad toward the glutes without lifting the hips.', 'Lower the pad under control.']
  ),
  (
    '10000000-0000-0000-0000-000000000014', 'Leg Extension',
    'A machine isolation exercise for knee extension.',
    'quadriceps', array[]::text[], 'leg extension machine', 'beginner',
    array['Align the machine pivot with the knees.', 'Extend the knees smoothly without bouncing.', 'Lower the pad under control.']
  ),
  (
    '10000000-0000-0000-0000-000000000015', 'Standing Calf Raise',
    'A standing plantar-flexion exercise.',
    'calves', array[]::text[], 'calf raise machine', 'beginner',
    array['Stand with the balls of the feet supported.', 'Rise as high as comfortable onto the toes.', 'Lower the heels through a controlled range.']
  ),
  (
    '10000000-0000-0000-0000-000000000016', 'Barbell Hip Thrust',
    'A loaded hip-extension exercise performed against a bench.',
    'glutes', array['hamstrings', 'core'], 'barbell', 'intermediate',
    array['Place the upper back against a stable bench.', 'Drive through the heels and extend the hips.', 'Finish with a neutral torso, then lower under control.']
  ),
  (
    '10000000-0000-0000-0000-000000000017', 'Lat Pulldown',
    'A machine-assisted vertical pulling movement.',
    'latissimus dorsi', array['biceps', 'upper back'], 'cable machine', 'beginner',
    array['Sit securely and grip the bar above shoulder width.', 'Pull the bar toward the upper chest by driving the elbows down.', 'Return to full arm extension under control.']
  ),
  (
    '10000000-0000-0000-0000-000000000018', 'Seated Cable Row',
    'A seated horizontal pulling movement.',
    'upper back', array['latissimus dorsi', 'biceps', 'rear deltoids'], 'cable machine', 'beginner',
    array['Sit tall with a neutral spine.', 'Pull the handle toward the lower ribs.', 'Extend the arms without rounding the lower back.']
  ),
  (
    '10000000-0000-0000-0000-000000000019', 'Dumbbell Lateral Raise',
    'An isolation exercise that raises the arms away from the torso.',
    'side deltoids', array['upper trapezius'], 'dumbbells', 'beginner',
    array['Hold light dumbbells with softly bent elbows.', 'Raise the arms to approximately shoulder height.', 'Lower slowly while maintaining control.']
  ),
  (
    '10000000-0000-0000-0000-000000000020', 'Burpee',
    'A full-body conditioning exercise combining a squat, plank, and jump.',
    'full body', array['quadriceps', 'chest', 'shoulders', 'core'], 'bodyweight', 'intermediate',
    array['Squat and place the hands on the floor.', 'Step or jump into a stable plank.', 'Return the feet forward and stand or jump vertically.']
  ),
  (
    '10000000-0000-0000-0000-000000000021', 'Mountain Climber',
    'A dynamic plank exercise alternating knee drives.',
    'core', array['hip flexors', 'shoulders', 'quadriceps'], 'bodyweight', 'beginner',
    array['Begin in a strong straight-arm plank.', 'Drive one knee toward the chest.', 'Alternate legs while keeping the hips stable.']
  ),
  (
    '10000000-0000-0000-0000-000000000022', 'Treadmill Running',
    'Steady-state or interval running performed on a treadmill.',
    'cardiovascular system', array['quadriceps', 'hamstrings', 'calves'], 'treadmill', 'beginner',
    array['Start at a comfortable walking pace.', 'Increase speed gradually while maintaining an upright posture.', 'Cool down by reducing speed before stopping.']
  ),
  (
    '10000000-0000-0000-0000-000000000023', 'Stationary Cycling',
    'Low-impact cardiovascular exercise on a stationary bicycle.',
    'cardiovascular system', array['quadriceps', 'glutes', 'hamstrings'], 'stationary bike', 'beginner',
    array['Adjust the seat so the knee remains slightly bent at the bottom.', 'Pedal with a smooth cadence.', 'Change resistance gradually to match the intended effort.']
  ),
  (
    '10000000-0000-0000-0000-000000000024', 'Jump Rope',
    'Rhythmic cardiovascular exercise using a skipping rope.',
    'calves', array['shoulders', 'forearms', 'cardiovascular system'], 'jump rope', 'intermediate',
    array['Keep the elbows close and turn the rope with the wrists.', 'Use small, quiet jumps from the balls of the feet.', 'Maintain a relaxed upright posture.']
  ),
  (
    '10000000-0000-0000-0000-000000000025', 'Russian Twist',
    'A seated rotational trunk exercise.',
    'obliques', array['abdominals', 'hip flexors'], 'bodyweight', 'beginner',
    array['Sit with the torso leaned back and the spine long.', 'Brace the abdomen and rotate the ribcage to one side.', 'Return through the centre and repeat on the other side.']
  )
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  primary_muscle = excluded.primary_muscle,
  secondary_muscles = excluded.secondary_muscles,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  instructions = excluded.instructions;

insert into public.achievements(id,code,title,description,icon,category,requirement_type,requirement_value,is_active) values
('20000000-0000-0000-0000-000000000001','FIRST_WORKOUT','First Workout','Complete your first workout.','barbell-outline','consistency','workout_count',1,true),
('20000000-0000-0000-0000-000000000009','WORKOUTS_5','5 Workouts','Complete five workouts.','barbell-outline','consistency','workout_count',5,true),
('20000000-0000-0000-0000-000000000002','WORKOUTS_10','10 Workouts','Complete ten workouts.','barbell-outline','consistency','workout_count',10,true),
('20000000-0000-0000-0000-000000000010','WORKOUTS_50','50 Workouts','Complete fifty workouts.','ribbon-outline','consistency','workout_count',50,true),
('20000000-0000-0000-0000-000000000003','WORKOUTS_100','100 Workouts','Complete one hundred workouts.','trophy-outline','consistency','workout_count',100,true),
('20000000-0000-0000-0000-000000000011','STREAK_3','3 Day Streak','Train on three consecutive UTC dates.','flame-outline','streaks','streak_days',3,true),
('20000000-0000-0000-0000-000000000004','STREAK_7','7 Day Streak','Train on seven consecutive UTC dates.','flame-outline','streaks','streak_days',7,true),
('20000000-0000-0000-0000-000000000012','STREAK_30','30 Day Streak','Train on thirty consecutive UTC dates.','flame-outline','streaks','streak_days',30,true),
('20000000-0000-0000-0000-000000000013','FIRST_PR','First Personal Record','Set your first confirmed personal record.','trending-up-outline','strength','personal_records',1,true),
('20000000-0000-0000-0000-000000000014','PRS_10','10 Personal Records','Set ten confirmed personal records.','trending-up-outline','strength','personal_records',10,true),
('20000000-0000-0000-0000-000000000006','FIRST_FRIEND','First Friend','Make your first fitness friend.','people-outline','social','friend_count',1,true),
('20000000-0000-0000-0000-000000000015','FIRST_CHALLENGE','First Challenge','Join or create your first challenge.','flag-outline','social','challenges_joined',1,true),
('20000000-0000-0000-0000-000000000007','CHALLENGE_WIN','Challenge Winner','Finish a finalized challenge in shared first place and reach its target.','medal-outline','social','challenge_wins',1,true),
('20000000-0000-0000-0000-000000000016','CHALLENGES_5','Complete 5 Challenges','Reach the target in five different challenges.','checkmark-circle-outline','social','challenges_completed',5,true),
('20000000-0000-0000-0000-000000000005','VOLUME_10000','Lift 10,000 kg','Accumulate 10,000 kg of completed set volume.','fitness-outline','volume','total_volume',10000,true),
('20000000-0000-0000-0000-000000000017','VOLUME_100000','Marathon Lifter','Accumulate 100,000 kg of completed set volume.','fitness-outline','volume','total_volume',100000,true),
('20000000-0000-0000-0000-000000000018','VOLUME_1000000','Lift 1,000,000 kg','Accumulate 1,000,000 kg of completed set volume.','trophy-outline','volume','total_volume',1000000,true),
('20000000-0000-0000-0000-000000000008','PRS_5','Personal Best','Legacy badge: five personal records.','trending-up-outline','strength','personal_records',5,false)
on conflict(code) do update set title=excluded.title,description=excluded.description,icon=excluded.icon,
 category=excluded.category,requirement_type=excluded.requirement_type,requirement_value=excluded.requirement_value,is_active=excluded.is_active;

-- Media URLs deliberately remain NULL until licensed, reviewed tutorials and
-- appropriately sized thumbnails are uploaded to exercise-media.
update public.exercises e
set form_tips = cues.tips, common_mistakes = cues.mistakes
from (values
  ('Back Squat', array['Brace before each repetition.', 'Keep pressure across the whole foot.'], array['Letting the knees collapse inward.', 'Losing trunk control at the bottom.']),
  ('Conventional Deadlift', array['Keep the bar close to the legs.', 'Brace before lifting.'], array['Jerking the bar off the floor.', 'Leaning backward at lockout.']),
  ('Barbell Bench Press', array['Keep the shoulder blades supported on the bench.', 'Use a spotter or safety arms for heavy sets.'], array['Bouncing the bar off the chest.', 'Lifting the hips from the bench.']),
  ('Standing Overhead Press', array['Stack the ribs over the pelvis.', 'Finish with the bar over the shoulders.'], array['Overarching the lower back.', 'Pressing around rather than past the head.']),
  ('Pull-Up', array['Initiate with engaged shoulders.', 'Control the lowering phase.'], array['Swinging to create momentum.', 'Shrugging the shoulders toward the ears.']),
  ('Push-Up', array['Maintain a straight body line.', 'Keep the elbows comfortably angled back.'], array['Sagging at the hips.', 'Flaring the elbows excessively.']),
  ('Bent-Over Barbell Row', array['Hold a consistent torso angle.', 'Pull toward the lower ribs.'], array['Rounding the back.', 'Using a large torso swing.']),
  ('Forward Lunge', array['Choose a stride that lets you stay balanced.', 'Keep the front heel grounded.'], array['Taking an excessively narrow step.', 'Driving the knee inward.']),
  ('Front Plank', array['Breathe while maintaining abdominal tension.', 'Keep the neck aligned with the torso.'], array['Holding the breath.', 'Letting the hips sag.']),
  ('Dumbbell Biceps Curl', array['Keep the upper arms still.', 'Use a controlled lowering phase.'], array['Swinging the torso.', 'Letting the wrists bend excessively.']),
  ('Cable Triceps Pushdown', array['Keep the elbows beside the ribs.', 'Use a comfortable grip.'], array['Moving the elbows forward and back.', 'Using the torso to push the weight.']),
  ('Leg Press', array['Keep the pelvis against the pad.', 'Choose a range you can control.'], array['Lifting the lower back from the pad.', 'Forcefully locking the knees.']),
  ('Lying Leg Curl', array['Align the machine pivot with the knees.', 'Keep the hips supported.'], array['Lifting the hips.', 'Dropping the weight on the return.']),
  ('Leg Extension', array['Adjust the pad just above the ankle.', 'Move without bouncing.'], array['Using momentum to start.', 'Lifting off the seat.']),
  ('Standing Calf Raise', array['Pause briefly at the top.', 'Use a controlled comfortable stretch.'], array['Bouncing out of the bottom.', 'Rolling onto the outside of the feet.']),
  ('Barbell Hip Thrust', array['Keep the ribs down at lockout.', 'Pad the bar for comfort.'], array['Hyperextending the lower back.', 'Pushing mainly through the toes.']),
  ('Lat Pulldown', array['Pull toward the upper chest.', 'Keep the torso mostly upright.'], array['Pulling behind the neck.', 'Rocking the torso to move the weight.']),
  ('Seated Cable Row', array['Keep the spine long.', 'Let the arms extend under control.'], array['Rounding the lower back.', 'Leaning far backward.']),
  ('Dumbbell Lateral Raise', array['Use light weights you can control.', 'Maintain a soft elbow bend.'], array['Shrugging excessively.', 'Swinging the dumbbells upward.']),
  ('Burpee', array['Use a step-back variation when needed.', 'Land softly.'], array['Letting the lower back sag in the plank.', 'Landing with stiff knees.']),
  ('Mountain Climber', array['Keep the hands under the shoulders.', 'Start slowly before increasing cadence.'], array['Bouncing the hips high.', 'Holding the breath.']),
  ('Treadmill Running', array['Increase speed gradually.', 'Use the safety clip.'], array['Stepping onto a fast moving belt.', 'Holding the rails while running.']),
  ('Stationary Cycling', array['Adjust the saddle before starting.', 'Keep a smooth cadence.'], array['Using a saddle that is too low.', 'Rocking the hips side to side.']),
  ('Jump Rope', array['Turn the rope with the wrists.', 'Keep jumps low and quiet.'], array['Jumping excessively high.', 'Using large arm circles.']),
  ('Russian Twist', array['Rotate the ribcage under control.', 'Keep the feet supported if needed.'], array['Rounding the lower back.', 'Swinging the arms without trunk control.'])
) as cues(name, tips, mistakes)
where e.name = cues.name;

commit;
