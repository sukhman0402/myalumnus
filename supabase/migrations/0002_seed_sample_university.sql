-- My Alumnus · sample data: the fictional "Sample University" (planning/02 §0). Nothing here is a real person.
do $$
declare u uuid; c uuid; g1 uuid; g2 uuid;
begin
  insert into public.universities (name, languages) values ('Sample University', '{en,hi}') returning id into u;
  insert into public.campuses (university_id, name) values (u, 'Main campus') returning id into c;
  insert into public.campus_rules (campus_id, university_id) values (c, u);
  insert into public.gates (university_id, campus_id, name) values (u, c, 'Gate 1') returning id into g1;
  insert into public.gates (university_id, campus_id, name) values (u, c, 'Gate 2') returning id into g2;

  -- console users. Emails ending .invalid can never receive mail: those rows can't sign in (by design).
  insert into public.staff (university_id, email, name, role) values
    (u, '<first-admin-email>', '<first admin name>', 'admin'),  -- real value applied in the database; kept out of this public repo
    (u, 'a.kulkarni@sample-university.invalid', 'A. Kulkarni', 'admin'),
    (u, 'n.bose@sample-university.invalid', 'N. Bose', 'admin');
  insert into public.staff (university_id, email, name, role, gate_id) values
    (u, 'gate2@sample-university.invalid', 'Gate 2 iPad', 'gate', g2),
    (u, 'gate1@sample-university.invalid', 'Gate 1 iPad', 'gate', g1);
  insert into public.staff (university_id, name, role, gate_id, shift_label) values
    (u, 'R. Sharma', 'guard', g2, '08:00 AM–04:00 PM'),
    (u, 'M. Yadav',  'guard', g2, '04:00 PM–12:00 AM'),
    (u, 'P. Singh',  'guard', g1, '08:00 AM–04:00 PM');

  insert into public.people (university_id, kind, full_name, program, batch_year, roll_no, phone, photo_path, photo_added_on)
  select u, v.kind::public.person_kind, v.full_name, v.program, v.batch_year, v.roll_no, v.phone, v.photo_path, v.photo_added_on::date
  from (values
('alumnus','Rahul Verma','B.Tech Mechanical',2019,null,'+91 98765 43212','sample/p1.webp','2019-06-01'),
('alumnus','Rahul Mehta','B.Des',2016,null,null,null,null),
('faculty','Rahul Bhatia','Visiting faculty',null,null,null,null,null),
('alumnus','Priya Shah','B.Tech Computer Science',2016,null,null,'sample/p4.webp','2016-05-01'),
('alumnus','Priya Shah','B.Tech Civil Engineering',2021,null,null,'sample/p5.webp','2021-06-01'),
('alumnus','Suresh Iyer','B.Com',2011,null,null,'sample/p6.webp','2011-03-01'),
('alumnus','Neha Joshi','B.Sc Physics',2020,null,null,'sample/p7.webp','2020-05-01'),
('alumnus','Arjun Kapur','MBA',2017,null,null,'sample/p8.webp','2017-04-01'),
('alumnus','Arjun Kapoor','B.Tech Civil Engineering',2009,null,null,null,null),
('faculty','Dr. Anjali Mehta','Visiting faculty',null,null,null,'sample/p10.webp','2026-09-01'),
('placement','Kiran Desai','Placement visitor · TechNova (sample)',null,null,null,'sample/p11.webp','2026-09-01'),
('faculty','Farah Siddiqui','Visiting faculty',null,null,null,null,null),
('alumnus','Vikram Rao','M.Tech Electrical',2015,null,null,'sample/p13.webp','2015-07-01'),
('alumnus','Priya Nair','M.A. English',2018,null,'+91 98765 43211','sample/p14.webp','2018-07-01'),
('alumnus','Ishaan Bose','B.Tech Electrical',2014,null,null,'sample/p15.webp','2014-06-01'),
('alumnus','Meera Nair','B.Des',2022,null,null,'sample/p16.webp','2022-06-01'),
('alumnus','Kabir Sethi','BBA',2013,null,null,'sample/p17.webp','2013-05-01'),
('alumnus','Tanvi Desai','B.Sc Chemistry',2019,null,null,'sample/p18.webp','2019-06-01'),
('student','Aarav Shah','B.Tech Computer Science · 2nd year',null,'23BCS041',null,'sample/s1.webp','2023-08-01'),
('student','Diya Patel','B.Des · 3rd year',null,'22BDS017',null,'sample/s2.webp','2022-08-01')
  ) as v(kind, full_name, program, batch_year, roll_no, phone, photo_path, photo_added_on);
end $$;
