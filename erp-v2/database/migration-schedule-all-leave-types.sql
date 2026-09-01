begin;

alter table public.schedules
  drop constraint if exists schedules_shift_type_check;

alter table public.schedules
  add constraint schedules_shift_type_check
  check (shift_type in (
    'day','night','mobile','special','cash','custom','off',
    'annual','personal','sick','marriage','bereavement','maternity','paternity',
    'menstrual','official','occupational','compensatory','unpaid','typhoon_unpaid','other'
  ));

comment on column public.schedules.shift_type is
  '勤務班別或假別；假別與請假申請共用代碼。';

commit;
