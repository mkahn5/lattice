from databricks.sdk import WorkspaceClient


def fetch_jobs(w: WorkspaceClient, limit: int = 200) -> list[dict]:
    results = []
    try:
        for j in w.jobs.list(expand_tasks=True):
            settings = j.settings
            # Collect cluster IDs and detect serverless tasks
            cluster_ids: list[str] = []
            serverless_tasks = 0
            if settings and settings.tasks:
                for task in settings.tasks:
                    cid = getattr(task, "existing_cluster_id", None)
                    jck = getattr(task, "job_cluster_key", None)
                    if cid:
                        cluster_ids.append(str(cid))
                    elif not jck:
                        # No existing cluster, no job-cluster key → serverless
                        serverless_tasks += 1
            total_tasks = len(settings.tasks) if settings and settings.tasks else 0
            results.append({
                "id": f"job:{j.job_id}",
                "type": "Job",
                "name": settings.name if settings else str(j.job_id),
                "fqn": str(j.job_id),
                "creator_user_name": j.creator_user_name or "",
                "created_time": str(j.created_time) if j.created_time else None,
                "task_count": total_tasks,
                "schedule": str(settings.schedule.quartz_cron_expression) if settings and settings.schedule else None,
                "cluster_ids": list(set(cluster_ids)),
                "uses_serverless": serverless_tasks > 0 and len(cluster_ids) == 0,
            })
            if len(results) >= limit:
                break
    except Exception as e:
        print(f"[jobs] error: {e}")
    return results
