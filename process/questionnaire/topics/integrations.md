# Topic: integrations (INT)

Ask per external system named in C06 or the description. Group systems with identical answers. Read available API documentation first and propose answers from it.

Rows are information needs; the phrasing is an example — formulate the best question for the project (`process/questionnaire/README.md`).

| ID | Level | Information need — example phrasing |
|---|---|---|
| INT-01 | XS | Purpose and access: what data or action flows, in which direction, triggered by what? Is there documentation / an API spec (link) and a sandbox or test account the agents can use? |
| INT-02 | S | Protocol and authentication (proposed from the docs): REST, GraphQL, SOAP, files, queue, webhook, SDK? API key, OAuth2, …? Who provides the credentials? |
| INT-03 | M | When the system is down or slow: retry, queue, degrade, or fail visibly? Who owns the master data, and how do fields map? |
| INT-04 | L | Rate limits and costs per call; stability of the external system (versioned, still changing, owned by another team)? |

Agent decides (shown at the design gate): client library, timeout and retry parameters, mapping implementation.
