# Topic: operations (OPS)

Where it runs is already answered by C04.

Rows are information needs; the phrasing is an example — formulate the best question for the project (`process/questionnaire/README.md`).

| ID | Level | Information need — example phrasing |
|---|---|---|
| OPS-01 | M | Environments (dev, test/staging, prod), existing CI/CD to use, who approves deployments, who operates and supports the system after go-live (runbook needed)? |
| OPS-02 | L | Release strategy (rolling, blue-green, canary, feature flags) and cadence; monitoring and alerting (tools, who is alerted); backup and disaster recovery (acceptable data loss and restore time); budget for running costs? |

Agent decides (shown at the design gate): CI pipeline layout, infrastructure as code tool, container setup, environment configuration.
