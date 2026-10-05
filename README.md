# Duty

근무표 엑셀 업로드, MySQL 저장, 월별 달력형 테이블 조회를 위한 기본 구성입니다.

## 실행

```bash
docker compose up -d mysql84-duty
```

```bash
cd duty-api
cp .env.example .env
npm install
npm run start:dev
```

```bash
cd duty-web
cp .env.example .env
npm install
npm run dev
```

- API: `http://localhost:3300`
- Web: `http://localhost:5173`
- MySQL container: `mysql84-duty`

## API

- `POST /duties/upload`: `file` 필드에 `.xlsx`, `.xls`, `.csv` 업로드
- `GET /duties?year=2026&month=7`: 월별 근무표 조회
- `GET /duties/logs`: 업로드 로그 조회
- `POST /auth/send-code`: 로그인 인증 코드 발송
- `POST /auth/verify-code`: 인증 코드 확인 후 member/master 생성 또는 갱신

## Schema

TypeORM `synchronize: true`로 엔티티 기준 테이블을 생성합니다. 수동 DDL은 [duty-api/src/database/schema.sql](/home/manic/projects/duty/duty-api/src/database/schema.sql)에 있습니다.

## Mail

`duty-api/.env`의 SMTP 값을 채우면 실제 메일을 발송합니다. 비어 있으면 개발용으로 API 서버 콘솔에 인증코드를 출력합니다.

```bash
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASSWORD=app-password
SMTP_FROM=DutyFlow <no-reply@example.com>
```
