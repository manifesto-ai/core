node dist/cli/index.js --provider openai --verbose "사용자는 이름을 입력해야 한다." -o schema_level_1.json

node dist/cli/index.js --provider openai --verbose "사용자는 이름을 입력한다. 이메일 인증이 완료되면, UI에서는 ‘이메일 입력이 필요함’을 표시해야 한다." -o schema_level_2.json

node dist/cli/index.js --provider openai --verbose "사용자는 회원가입을 한다. 이메일 인증이 완료되면 계정이 활성화된다. 활성화된 계정만 서비스를 이용할 수 있다." -o schema_level_3.json

node dist/cli/index.js --provider openai --verbose "관리자는 이메일 인증 없이도 계정을 활성화할 수 있다. 일반 사용자는 이메일 인증이 필요하다." -o schema_level_4.json

node dist/cli/index.js --provider openai --verbose "사용자는 회원가입을 한다.

가입 직후에는 계정이 비활성화 상태다.

이메일 인증을 완료하면 계정이 활성화된다.

단, 관리자는 이메일 인증 없이도 계정을 활성화할 수 있다.

관리자가 강제로 활성화한 계정은 이후 이메일 인증을 하더라도
인증 완료 시점이 기록되지는 않는다.

이메일 인증은 24시간 안에 완료되어야 하며,
24시간이 지나면 인증 링크는 만료된다.

만료된 이후에 인증을 시도하면
계정은 다시 비활성화 상태로 돌아가고
새로운 인증 요청을 해야 한다.

사용자가 세 번 연속 인증에 실패하면
계정은 잠금 상태가 되며
관리자가 직접 잠금을 해제해야 한다.

잠금 해제 후에는 인증 시도 횟수가 초기화된다.

단, 이미 활성화된 계정은
이후 이메일 인증 실패나 만료가 발생하더라도
다시 비활성화되지는 않는다.

시스템은 현재 계정의 상태를
inactive, pending, active, locked 중 하나로 표시해야 하며
UI에서는 이 상태에 따라 가능한 행동만 노출해야 한다." -o schema_level_5.json

