# Google Cloud deployment checklist

**Precondition:** This project is a scaffold. Deploy the final application only after real Gemini integration, controlled auth/demo mode, and reproducible tests have been implemented.

## 1. Set up a new GCP project
1. Create/bind billing with a clear budget alert (budgets notify; they don't necessarily hard-stop resources).
2. Choose supported Singapore location `asia-southeast1` for Cloud Run and Firestore where available, and separately verify the Vertex AI model region.
3. Enable necessary services: Cloud Run, Cloud Build, Artifact Registry, Vertex AI and Firestore (plus IAM and Secret Manager if needed).
4. Create Firestore database in the intended region before ingestion. Verify the appropriate Firestore vector index by current cloud documentation. Avoid bulk embedding until the index and auth work.
5. Set up a dedicated service identity with minimum access to relevant Vertex AI and Firestore; do not bake account keys into the container.

## 2. Configure variables
Copy `.env.example` into `.env.local` for local only, set project/region/model. Cloud Run config via `--set-env-vars` for nonsensitive values and Secret Manager for secrets. Don't commit `.env.local`.

## 3. Deploy container from source
```bash
# Example only: choose your actual unique project and available region/model.
gcloud config set project YOUR_GCP_PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com aiplatform.googleapis.com firestore.googleapis.com
# Authenticate CLI locally; production Cloud Run uses its assigned service account.
gcloud run deploy knowbridge --source . --region asia-southeast1 --allow-unauthenticated
```

**Before using `--allow-unauthenticated`:** confirm that the exposed UI uses only synthetic demo data, read-only Q&A, restricted API rate/size limits, and no public ingestion/write endpoints. Otherwise deploy with auth restrictions. The Demo page must state this is synthetic data. `--allow-unauthenticated` enables a public URL but does NOT secure individual API routes.

## 4. Validate deployed app
- `GET /api/health` returns live AI state only if integrated.
- Hero question returns accurate references for at least HBR-DOC-02, HBR-DOC-04, HBR-DOC-06.
- Missing evidence produces an abstention; attempts to reference unauthorized sources fail.
- No credentials or actual client data are exposed by public repository or API.
- Take a screenshot/video of real deployed app, not local-only mockups.

Official refs:
- https://docs.cloud.google.com/run/docs/deploying-source-code
- https://firebase.google.com/docs/firestore/vector-search
- https://docs.cloud.google.com/vertex-ai/generative-ai/docs/embeddings/get-text-embeddings
