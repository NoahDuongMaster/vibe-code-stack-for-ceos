# Hướng dẫn setup và deploy theo môi trường

[English](./setup-and-deployment.en.md) · **Tiếng Việt**

Tài liệu này là runbook từng bước cho người mới tham gia dự án. Các lệnh được
chạy từ thư mục gốc repository, trừ khi có ghi chú khác.

Nguồn cấu hình chính:

- Toolchain và lệnh vận hành: [`mise.toml`](../mise.toml)
- Env local mẫu: [`.env.sample`](../.env.sample) và các file `*.sample` trong
  từng workspace
- Cloudflare deploy: [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)
- AWS/Cloudflare infrastructure: [`infra/terraform/README.md`](../infra/terraform/README.md)
- Cloudflare resource/binding: các file `wrangler.jsonc` của từng workspace
- Docker và database recovery: [`infra/docker/README.md`](../infra/docker/README.md)

> Không chạy `wrangler deploy` hoặc lệnh deploy tương đương từ máy local.
> Staging và production chỉ được deploy qua GitHub Actions sau khi CI xanh.

## 1. Môi trường nào deploy những gì?

| Môi trường | Cách khởi động/deploy | Thành phần | Ghi chú |
| --- | --- | --- | --- |
| Local native | `mise run dev` | 3 frontend, 3 backend, PostgreSQL và VPC origin | Hot reload; gateway cần Cloudflare login và Tunnel token |
| Local Docker | `mise run docker:start` | Full development stack trong container | Dùng cùng topology VPC development |
| Staging | Push/merge vào `develop` | Landing Worker | Chỉ chạy sau CI xanh |
| Production | Push/merge vào `main` | Landing Worker | Cần GitHub Environment approval |

> Chế độ deploy hiện tại là **landing-only**. Các step AWS/RPC, gateway, dapp
> và admin vẫn được giữ trong workflow nhưng bị khóa bằng
> `FULL_STACK_DEPLOY_ENABLED: 'false'`. Các phần full-stack bên dưới là runbook
> chuẩn bị cho lúc bật lại, không phải prerequisite để deploy landing.

Hai service RPC cùng PostgreSQL 18/pgBackRest chạy bằng Docker trên một private
EC2 cố định cho mỗi môi trường. Terraform provision ECR, encrypted EBS,
Secrets Manager, KMS, Cloudflare Tunnel và hai Workers VPC Services; GitHub
Actions deploy image qua SSM, không SSH và không public RPC/database port.

## 2. Setup local native từ máy mới

### Bước 1: Cài prerequisite

Cần có:

- Git
- [mise](https://mise.jdx.dev/installing-mise.html)
- Docker Engine có Docker Compose, hoặc Docker Desktop/OrbStack
- Quyền truy cập Cloudflare của dự án nếu cần chạy gateway/full stack

Node.js và pnpm không cần cài thủ công; mise sẽ cài đúng phiên bản được khóa
trong repository.

### Bước 2: Clone và cài dependencies

```bash
git clone https://github.com/NoahDuongMaster/vibe-code-stack-for-ceos.git
cd vibe-code-stack-for-ceos
mise run setup
mise run toolchain:check
```

### Bước 3: Tạo toàn bộ env local

Chỉ chạy các lệnh copy này trên fresh clone. Không ghi đè `.env` đã có nếu máy
đã chứa secret hoặc override riêng.

```bash
cp .env.sample .env
cp apps/dapp/.env.sample apps/dapp/.env
cp apps/dapp/.dev.vars.sample apps/dapp/.dev.vars
cp apps/admin/.env.sample apps/admin/.env
cp apps/landing/.env.sample apps/landing/.env
cp services/trading-rpc/.env.sample services/trading-rpc/.env
cp services/admin-rpc/.env.sample services/admin-rpc/.env
cp services/api-gateway/.dev.vars.sample services/api-gateway/.dev.vars
```

Các sample đã có đủ giá trị để chạy local. Những giá trị sau là tùy chọn:

- Điền `COINGECKO_API_KEY` trong `services/trading-rpc/.env` để live market data
  ổn định hơn.
- Điền Sentry DSN nếu cần kiểm tra error monitoring; để trống sẽ tắt Sentry.
- `JWT_SECRET` trong sample gateway và admin-rpc giống nhau để local login chạy
  end-to-end; luôn thay bằng secret riêng ở staging/production.

Port local mặc định:

| Thành phần | Port |
| --- | ---: |
| dapp | `46000` |
| admin | `46001` |
| landing | `46002` |
| api-gateway | `46003` |
| trading-rpc Connect / gRPC | `46004` / `46005` |
| admin-rpc Connect / gRPC | `46006` / `46007` |
| PostgreSQL | `46008` |
| dapp / gateway inspector | `46009` / `46010` |
| Docker VPC origins | `46104`–`46107` |

Nếu một port đã bị chiếm, đổi Docker host port trong `.env` ở root. Các native
frontend/RPC port nằm trong config hoặc env của chính workspace. Dev server dùng
`strictPort`, vì vậy port conflict sẽ fail rõ ràng thay vì âm thầm đổi port.

### Bước 4: Setup Cloudflare development access

Bỏ qua bước này nếu chỉ chạy riêng frontend, PostgreSQL hoặc native RPC. Full
stack và gateway bắt buộc có remote Workers VPC bindings.

Đăng nhập Wrangler một lần:

```bash
pnpm --filter @services/api-gateway exec wrangler login
```

Lấy Tunnel token development đã được rotate từ người quản trị Cloudflare, sau
đó ghi bằng editor để token không xuất hiện trong shell history:

```bash
mkdir -p infra/docker/secrets
install -m 600 /dev/null infra/docker/secrets/cloudflare-tunnel-token
${EDITOR:-vi} infra/docker/secrets/cloudflare-tunnel-token
chmod 600 infra/docker/secrets/cloudflare-tunnel-token
```

Development Cloudflare account phải có hai VPC Services trỏ qua cùng Tunnel:

- Binding `TRADING_RPC` → HTTP `trading-rpc.internal:3001`
- Binding `ADMIN_RPC` → HTTP `admin-rpc.internal:3001`

Service IDs development được cấu hình trong
[`services/api-gateway/wrangler.jsonc`](../services/api-gateway/wrangler.jsonc).
Không dùng nhầm ID của một origin cho origin còn lại.

### Bước 5: Kiểm tra và khởi động

```bash
mise run docker:check
mise run dev
```

Các lựa chọn chạy từng phần:

```bash
mise run dev:web
mise run dev:admin
mise run dev:landing
mise run dev:api
mise run dev:admin-api
mise run dev:gateway
mise run dev:backend
```

`dev:api` tự khởi động PostgreSQL. `dev:gateway` và `dev` tự khởi động VPC
origin nhưng vẫn cần Wrangler authentication và Tunnel token ở bước 4.

### Bước 6: Smoke test

```bash
curl --fail http://127.0.0.1:46003/healthz
curl --fail http://127.0.0.1:46004/healthz
curl --fail http://127.0.0.1:46006/healthz

curl --fail -X POST \
  http://127.0.0.1:46003/trading.v1.TradingService/GetMarkets \
  -H 'content-type: application/json' \
  -H 'connect-protocol-version: 1' \
  --data '{"coinIds":["bitcoin","ethereum"],"vsCurrency":"usd"}'
```

Mở giao diện:

- dapp: `http://localhost:46000`
- admin: `http://localhost:46001`
- landing: `http://localhost:46002`

### Bước 7: Dừng local infrastructure

```bash
mise run dev:infra:stop
```

## 3. Setup local full Docker

Thực hiện các bước clone, env và Cloudflare development access ở phần 2, sau
đó chạy:

```bash
mise run docker:check
mise run docker:start
```

Xem trạng thái/log:

```bash
docker compose \
  -f infra/docker/compose.yaml \
  -f infra/docker/compose.dev.yaml \
  --profile dev --profile vpc ps
make logs-development
```

Dừng và xóa container/network development, nhưng giữ named database volume:

```bash
mise run docker:stop
```

Chỉ khi chắc chắn muốn xóa toàn bộ database local mới xóa volume
`postgres-data`; không dùng thao tác này như một bước setup thông thường.

## 4. Provision full-stack cho staging và production

Phần này chưa cần cho chế độ landing-only. Đây là bước one-time của người có
quyền quản trị trước khi bật lại full-stack; mỗi môi trường phải dùng resource,
URL, secret và VPC Service ID riêng.

### Bước 1: Bootstrap và apply Terraform

Làm one-time AWS root-of-trust bootstrap (S3 state bucket, GitHub OIDC provider
và Terraform execution role), sau đó khai báo các GitHub Environment value theo
[`infra/terraform/README.md`](../infra/terraform/README.md). Không chạy
`terraform apply` local.

Trong **Actions → Terraform → Run workflow**:

1. Chạy `staging` + `apply`, approve job plan, review plan artifact rồi approve
   riêng job apply. Apply staging chỉ nhận ref `develop`; production chỉ nhận
   `main`.
2. Copy output `github_deploy_role_arn` sang variable
   `AWS_RPC_DEPLOY_ROLE_ARN` của Environment staging.
3. Xác nhận email SNS gửi tới variable `OPERATIONS_ALERT_EMAIL`.
4. Lặp lại cho production; job production phải qua Required reviewers.

Terraform tạo private EC2, ba protected encrypted EBS volume, ECR, KMS,
Secrets Manager, CloudWatch, Tunnel và VPC Services. PostgreSQL Docker dùng lại
toàn bộ pgBackRest/R2 backup và restore-drill hiện có; không tạo AWS RDS. Secret
values không đi vào Terraform state.

### Bước 2: Provision Cloudflare resources

Trong Cloudflare account:

1. Tạo/kiểm tra hai Pages project `ai-first-admin-staging` và `ai-first-admin`;
   cả hai đặt production branch là `main`. Tách project giúp staging và
   production đều có rollback API độc lập.
2. Cấp API token đủ quyền quản lý Tunnel, Connectivity Directory/VPC Services,
   Workers và Pages. Terraform tạo Tunnel/VPC Services; không tạo tay.
3. Điền `CORS_ORIGINS` của môi trường bằng các origin thật của dapp và admin.
   Không để rỗng và không dùng wildcard ở production.
4. Tạo hai private R2 bucket PITR/archive và cấu hình Bucket Lock/lifecycle đúng
   theo [`infra/docker/README.md`](../infra/docker/README.md).

Worker names do source code quản lý:

| Target | Staging | Production |
| --- | --- | --- |
| dapp | `ai-first-dapp-staging` | `ai-first-dapp` |
| admin Pages | project `ai-first-admin-staging`, branch `main` | project `ai-first-admin`, branch `main` |
| landing | `ai-first-landing-staging` | `ai-first-landing` |
| gateway | `ai-gateway-staging` | `api-gateway-production` |

### Bước 3: Tạo GitHub Environments

Trong GitHub: **Settings → Environments**, tạo `staging` và `production`.
Environment `production` phải bật **Required reviewers**.

Thêm secrets sau cho từng environment:

| Secret | Bắt buộc | Ghi chú |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | Có | Token deploy giới hạn đúng account/resources cần thiết |
| `CLOUDFLARE_ACCOUNT_ID` | Có | Workflow đang đọc dưới dạng secret |
| `SESSION_SECRET` | Có | Tối thiểu 32 ký tự, khác sample và khác giữa hai môi trường |
| `DEMO_AUTH_EMAIL` | Có | Credential của reference dapp auth flow hiện tại |
| `DEMO_AUTH_PASSWORD` | Có | Không dùng placeholder local |
| `ADMIN_AUTH_EMAIL` | Có | Login identity cho admin-rpc |
| `ADMIN_AUTH_PASSWORD` | Có | Tối thiểu 12 ký tự |
| `JWT_SECRET` | Có | Tối thiểu 32 ký tự; dùng chung admin-rpc/gateway trong cùng môi trường |
| `COINGECKO_API_KEY` | Có | API key cho live market data |
| `POSTGRES_PASSWORD` | Có | Password application owner của PostgreSQL Docker |
| `POSTGRES_REPLICATION_PASSWORD` | Có | Password role replication dành cho pgBackRest |
| `R2_PITR_ACCESS_KEY_ID` | Có | Access key chỉ được cấp PITR bucket |
| `R2_PITR_SECRET_ACCESS_KEY` | Có | Secret tương ứng của PITR bucket |
| `R2_ARCHIVE_ACCESS_KEY_ID` | Có | Access key chỉ được cấp archive bucket |
| `R2_ARCHIVE_SECRET_ACCESS_KEY` | Có | Secret tương ứng của archive bucket |
| `PGBACKREST_CIPHER_PASSPHRASE` | Có | Mã hóa pgBackRest repository |
| `POSTGRES_BACKUP_AGE_IDENTITY` | Có | Age private identity, phải có bản escrow offline |
| `ADMIN_RPC_SENTRY_DSN` | Không | Telemetry admin-rpc |
| `TRADING_RPC_SENTRY_DSN` | Không | Telemetry trading-rpc |
| `SENTRY_AUTH_TOKEN` | Không | Chỉ cần khi upload source map |

Thêm variables sau cho từng environment:

| Variable | Ví dụ staging | Ghi chú |
| --- | --- | --- |
| `NEXT_PUBLIC_PROJECT_NAME` | `vibe-code-stack-for-ceos` | Tên hiển thị dapp |
| `NEXT_PUBLIC_API_ENDPOINT` | `https://<staging-gateway>` | Gateway URL của đúng môi trường |
| `NEXT_PUBLIC_BASE_URL` | `https://<staging-dapp>` | Public dapp origin |
| `ADMIN_PUBLIC_URL` | `https://<staging-admin>` | Public admin origin dùng cho smoke test |
| `PUBLIC_API_URL` | `https://<staging-gateway>` | Gateway URL được build vào admin |
| `PUBLIC_SITE_URL` | `https://<staging-landing>` | Canonical landing origin |
| `NEXT_PUBLIC_SENTRY_DSN` | để trống hoặc DSN | Runtime monitoring cho dapp |
| `PUBLIC_SENTRY_DSN` | để trống hoặc DSN | Workflow dùng chung cho admin và landing |
| `GATEWAY_CORS_ORIGINS` | `https://<admin>,https://<dapp>` | Allow-list thật; không chấp nhận `*` |
| `AWS_REGION` | `ap-southeast-1` | Region của Terraform và RPC runtime |
| `AWS_TERRAFORM_ROLE_ARN` | IAM role ARN | Role OIDC chạy plan/apply |
| `AWS_GITHUB_OIDC_PROVIDER_ARN` | IAM provider ARN | Root-of-trust account-level |
| `AWS_RPC_DEPLOY_ROLE_ARN` | Terraform output | Role OIDC build/push ECR và rollout SSM |
| `OPERATIONS_ALERT_EMAIL` | `on-call@example.com` | Email nhận alarm; phải confirm SNS subscription |
| `TF_STATE_BUCKET` | S3 bucket name | State bucket đã mã hóa/versioning |
| `TF_STATE_KMS_KEY_ARN` | KMS key ARN | Customer-managed key mã hóa Terraform state |
| `R2_PITR_BUCKET` | `<project>-postgres-pitr` | Private bucket cho WAL/PITR |
| `R2_ARCHIVE_BUCKET` | `<project>-postgres-archive` | Private bucket cho monthly archive |
| `POSTGRES_ARCHIVE_AGE_RECIPIENT` | `age1...` | Public age recipient dùng để mã hóa archive |
| `SENTRY_ORG` | để trống hoặc org | Dùng cùng `SENTRY_PROJECT` và token |
| `SENTRY_PROJECT` | để trống hoặc project | Bật Sentry source-map upload cho dapp |

Không thêm secret vào `wrangler.jsonc` hoặc GitHub variable không được mã hóa.

### Bước 4: Provision Worker runtime secrets

GitHub secrets ở bước build không tự động trở thành runtime bindings của
Cloudflare Worker. Người vận hành được ủy quyền phải provision dapp secrets một
lần cho từng môi trường:

```bash
pnpm --filter @apps/dapp exec wrangler secret put SESSION_SECRET --env staging
pnpm --filter @apps/dapp exec wrangler secret put DEMO_AUTH_EMAIL --env staging
pnpm --filter @apps/dapp exec wrangler secret put DEMO_AUTH_PASSWORD --env staging
```

Thay `staging` bằng `production` khi provision production. Wrangler sẽ prompt
giá trị; không truyền secret trực tiếp trong command line.

JWT auth là bắt buộc ở staging/production. Deploy workflow ghi cùng GitHub
Environment `JWT_SECRET` vào Secrets Manager cho admin-rpc và Wrangler secret
cho gateway; runtime cũng từ chối cấu
hình staging/production thiếu secret hoặc CORS allow-list. `secret put` là bước
provisioning; vẫn không chạy `wrangler deploy` từ local.

## 5. Deploy staging

### Preflight bắt buộc

- GitHub Environment `staging` có secrets `CLOUDFLARE_API_TOKEN`,
  `CLOUDFLARE_ACCOUNT_ID` và variable `PUBLIC_SITE_URL` đúng domain staging.
- `mise run verify` pass trên branch chuẩn bị merge.

### Các bước deploy

1. Tạo PR vào `develop`.
2. Chờ toàn bộ workflow **CI** xanh.
3. Merge PR vào `develop`.
4. CI chạy lại trên commit vừa merge.
5. Workflow **Deploy** tự nhận commit đã pass và chạy job
   **Deploy (staging)**.
6. Không deploy thủ công nếu job lỗi; sửa nguyên nhân và chạy lại qua commit/CI.

Workflow chỉ build landing, deploy Worker `ai-first-landing-staging`, gọi
`PUBLIC_SITE_URL` để smoke test và tự rollback landing nếu smoke test lỗi.

### Verify staging

Thay URL placeholder bằng URL thật đã cấu hình:

```bash
curl --fail https://<staging-landing>/
curl --fail https://<staging-landing>/robots.txt
```

Sau đó kiểm tra canonical metadata, sitemap và Cloudflare Worker logs của
landing.

## 6. Deploy production

### Preflight bắt buộc

- Commit đã được xác nhận ở staging.
- GitHub Environment `production` có secrets `CLOUDFLARE_API_TOKEN`,
  `CLOUDFLARE_ACCOUNT_ID` và variable `PUBLIC_SITE_URL` đúng domain production.
- Required reviewers đã bật và có người trực rollback.

### Các bước deploy

1. Tạo PR từ release branch hoặc `develop` vào `main`.
2. Chờ CI của PR xanh và review hoàn tất.
3. Merge vào `main`.
4. CI chạy lại trên commit `main`.
5. Workflow **Deploy** tạo job **Deploy (production)**.
6. Required reviewer kiểm tra commit SHA, staging evidence và approve GitHub
   Environment.
7. Theo dõi landing Worker deployment và automated smoke test tới khi hoàn tất.

Không chạy deploy từ laptop để “bù” một step lỗi. Workflow checkout chính xác
`head_sha` đã pass CI, vì vậy mọi sửa đổi phải quay lại Git và CI.

### Verify production

1. Kiểm tra `PUBLIC_SITE_URL` và `/robots.txt` trả HTTP thành công.
2. Kiểm tra canonical metadata và sitemap dùng đúng production origin.
3. Kiểm tra Cloudflare Worker logs và Sentry nếu landing đã bật DSN.

## 7. Rollback

Ở chế độ hiện tại, deploy workflow tự rollback landing Worker khi smoke test
lỗi. Sau recovery tức thời, ưu tiên rollback source bằng Git:

1. `git revert` commit gây lỗi trên branch tương ứng.
2. Push/merge revert vào `develop` hoặc `main`.
3. Chờ CI xanh và Deploy workflow chạy lại.
4. Verify lại theo checklist của môi trường.

Khi production incident cần rollback Worker ngay lập tức, operator được ủy
quyền có thể dùng lịch sử version của Cloudflare:

```bash
pnpm --filter @apps/landing exec wrangler rollback --env production
```

Các lệnh rollback dapp, gateway, admin và RPC chỉ áp dụng sau khi bật lại
full-stack. Luôn tạo Git revert để source và deployed state hội tụ lại.

## 8. Definition of done

Trước khi coi setup/deploy hoàn tất:

- [ ] Env và URL thuộc đúng môi trường; không còn placeholder `example.com`.
- [ ] Không có secret trong Git, shell history hoặc log.
- [ ] `mise run typecheck` pass.
- [ ] `mise run check:ci` pass.
- [ ] `mise run lint` pass.
- [ ] `mise run test` và `mise run test:coverage` pass.
- [ ] `mise run test:e2e:production` pass.
- [ ] `mise run build` pass.
- [ ] `mise run test:docker` pass.
- [ ] `mise run test:protocol` và `mise run security:audit` pass.
- [ ] `mise run terraform:check` pass nếu thay đổi AWS/Cloudflare IaC.
- [ ] Landing URL, canonical metadata, sitemap và rollback evidence đã kiểm tra.
- [ ] Khi bật full-stack: gateway/RPC smoke tests, CORS và backup health pass.

## 9. Các giới hạn hiện tại cần giải quyết

- Root-of-trust AWS state bucket, GitHub OIDC provider và Terraform execution
  role vẫn là account-level bootstrap, không thể tự tạo từ state phụ thuộc vào
  chính chúng.
- Workers VPC Services hiện là Cloudflare beta; phải review release notes khi
  nâng Cloudflare provider.
- Sau Terraform apply đầu tiên phải copy output deploy-role ARN vào GitHub
  Environment và confirm SNS subscription trước khi nhận traffic.

Không đánh dấu một môi trường là “ready” cho tới khi các mục liên quan phía trên
được xử lý hoặc có quyết định chấp nhận rủi ro được ghi lại.
