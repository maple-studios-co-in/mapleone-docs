# Learning path — AWS & AI infrastructure

*For the team executing [deployment-runbook.md](deployment-runbook.html). Each topic says why **we** need it, the one best resource, and which runbook stage it unlocks. Approach: 1–2 hours of the linked resource, then immediately do that stage's steps — don't binge courses. Everything AWS below is free-tier-friendly to practice. AWS Skill Builder (free tier) and the service User Guides are deliberately preferred over third-party courses: they don't go stale.*

## Level 0 — foundations everyone touches (before Stage 0)

| Topic | Why we need it | Best resource | Time |
|---|---|---|---|
| Docker & Compose | Every module ships as a container; the box runs Compose | [Docker Get Started](https://docs.docker.com/get-started/) parts 1–5, then [Compose intro](https://docs.docker.com/compose/) | 3–4 h |
| Linux server basics | SSH, systemd, disks, logs — Stage 4 lives here | [Ubuntu Server basics tutorial](https://ubuntu.com/tutorials/command-line-for-beginners) | 2 h |
| How DNS works | Route 53, subdomain-per-module, white-label domains | [Cloudflare Learning: DNS](https://www.cloudflare.com/learning/dns/what-is-dns/) | 1 h |
| HTTPS/TLS + reverse proxy | Caddy terminates TLS and routes by Host header | [Caddy — Getting Started](https://caddyserver.com/docs/getting-started) + [reverse_proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy) | 1–2 h |
| Git + GitHub Actions | CI builds/pushes images; deploys on merge | [GitHub Actions quickstart](https://docs.github.com/en/actions/quickstart) + [understanding workflows](https://docs.github.com/en/actions/using-workflows) | 2 h |
| Prisma migrations | Every module owns its schema + migrations | [Prisma Migrate docs](https://www.prisma.io/docs/orm/prisma-migrate) (we use `db push` today — read why migrate is the production path) | 1 h |
| Web security basics | The B1–B10 blockers ([team-tasks.md](team-tasks.html)) are OWASP classics — broken access control, mass assignment; whoever fixes them should recognize the *class*, not just the instance | [OWASP Top 10](https://owasp.org/www-project-top-ten/) | 2 h |

## Stage-by-stage (read just-in-time, then execute)

| Runbook stage | Learn | Resource |
|---|---|---|
| 0 · Accounts | IAM users/roles/policies, MFA, why root is radioactive | [IAM User Guide — intro + best practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html) |
| 1 · DNS/network | Route 53 hosted zones; VPC, subnets, security groups | [Route 53 Getting Started](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/getting-started.html) · [VPC concepts](https://docs.aws.amazon.com/vpc/latest/userguide/what-is-amazon-vpc.html) · [Security groups](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-security-groups.html) |
| 2 · Registry/CI | ECR push/pull; GitHub→AWS OIDC (no stored keys) | [ECR Getting Started](https://docs.aws.amazon.com/AmazonECR/latest/userguide/getting-started-cli.html) · [Configuring OIDC in AWS](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services) |
| 3 · Data layer | RDS Postgres (backups, restore, parameter basics); S3 + versioning; CloudFront OAC; Secrets Manager vs SSM | [RDS PostgreSQL User Guide](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_PostgreSQL.html) · [S3 Getting Started](https://docs.aws.amazon.com/AmazonS3/latest/userguide/GetStartedWithS3.html) · [CloudFront + S3 OAC](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html) · [Secrets Manager intro](https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html) |
| 4 · The box | EC2 lifecycle, Elastic IPs; CloudWatch agent + alarms | [EC2 Getting Started](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/EC2_GetStarted.html) · [CloudWatch alarms](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/AlarmThatSendsEmail.html) |
| 7 · Ops | The mental model for "is this well built?" | [AWS Well-Architected Framework](https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html) — skim the six pillars once, revisit quarterly |
| Phase 3 (later) | Containers without servers: ECS Fargate, ALB, task defs | [ECS Workshop](https://ecsworkshop.com/) · [ALB intro](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/introduction.html) |

## AI infrastructure track (pairs with the AI steps in [aws-deployment.md](aws-deployment.html) §5)

### Step A — using model APIs well (now)
| Topic | Why | Resource |
|---|---|---|
| Anthropic API: messages, streaming, structured outputs, PDF inputs | The catalog parser and photoshoot wizard are built on these | [Anthropic docs](https://platform.claude.com/docs/) — Messages, Streaming, Structured Outputs, PDF support pages |
| Prompt engineering fundamentals | Parse quality = prompt + schema quality | [Anthropic prompt engineering guide](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview) |
| Token economics & caching | The gateway's spend log needs interpreting | [Anthropic pricing](https://www.anthropic.com/pricing) + prompt-caching docs |
| API gateway patterns | Why one internal door to AI (keys, budgets, fallbacks) | Our own [aws-deployment.md §5](aws-deployment.html) + [er-platform.md](er-platform.html) — this IS the reference |

### Step B — managed models in-account (when a client demands residency)
| Topic | Why | Resource |
|---|---|---|
| Amazon Bedrock | Same models, IAM auth, India-region residency | [Bedrock User Guide — Getting Started](https://docs.aws.amazon.com/bedrock/latest/userguide/getting-started.html) |

### Step C — our own models (when the spend log says so)
| Topic | Why | Resource | Depth |
|---|---|---|---|
| How LLMs actually work (one-time foundation) | You can't debug what you can't picture | [Karpathy — Intro to LLMs (1 h video)](https://www.youtube.com/watch?v=zjkBMFhNj_g) | everyone |
| Serving open models | vLLM is the standard self-host server | [vLLM docs — quickstart](https://docs.vllm.ai/en/latest/getting_started/quickstart.html) | whoever owns infra |
| Managed inference | SageMaker endpoints = vLLM without the ops | [SageMaker real-time inference](https://docs.aws.amazon.com/sagemaker/latest/dg/realtime-endpoints.html) | whoever owns infra |
| Fine-tuning with LoRA | Our correction-loop trains adapters, not full models | [Hugging Face PEFT docs](https://huggingface.co/docs/peft/index) + [LoRA conceptual guide](https://huggingface.co/docs/peft/conceptual_guides/lora) | ML-curious dev |
| Dataset building & evals | The moat is the corrections dataset + the regression harness | [Hugging Face — datasets](https://huggingface.co/docs/datasets/index) · our regression sets (quotations R-suites) are the eval template | ML-curious dev |
| GPU economics | The buy-vs-API decision needs real numbers | [EC2 G-family pricing](https://aws.amazon.com/ec2/instance-types/g5/) vs the gateway spend log | founder + infra |

## Suggested split for a two-person start

- **DevOps-lead:** Level 0 (all) → Stages 0–4 just-in-time → Well-Architected skim → later ECS workshop.
- **Dev-lead:** Docker + Actions + Prisma from Level 0 → Stage 2 (CI) + Stage 5 code tasks → AI Step A docs (they already touch this code in quotations) → LoRA/evals when Step C approaches.
- **Both:** the restore drill (Stage 6) — done together, once per quarter, no exceptions.

*Rule of thumb: no stage of the runbook should be executed by someone who hasn't done its "Learn" row — and no one should read more than one stage ahead of what's actually being built.*
