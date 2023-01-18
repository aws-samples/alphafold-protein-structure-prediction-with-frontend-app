import json
import os
import re
import time
import uuid
from http import HTTPStatus

import boto3
from aws_lambda_powertools import Logger
from aws_lambda_powertools.event_handler.api_gateway import Router
from common import NotFoundError, make_response

logger = Logger()
router = Router()

ssm_instance_id = os.environ["SSM_INSTANCE_ID"]
ssm_username = os.environ["SSM_COMMAND_USERNAME"]
s3_bucket_name = os.environ["S3_BUCKET_NAME"]
ssm = boto3.client("ssm")
s3 = boto3.client("s3")


def run_shellscript(cmd, max_retry=10):
    retry_cnt = 0
    res_from_send_command = ssm.send_command(
        InstanceIds=[ssm_instance_id],
        DocumentName="AWS-RunShellScript",
        Parameters={"commands": ["sudo su - %s -c '%s'" % (ssm_username, cmd)]},
    )

    command_id = res_from_send_command["Command"]["CommandId"]
    time.sleep(2)
    data = ""

    while True:
        res = ssm.get_command_invocation(
            CommandId=command_id, InstanceId=ssm_instance_id
        )
        data = res["StandardOutputContent"]
        if data != "":
            break
        if retry_cnt > max_retry:
            logger.warn(f"timeout: {cmd}")
            break
        retry_cnt += 1
        time.sleep(1)

    return json.loads(data)


@router.get("/<target>/jobs")
def get_jobs(target):
    logger.info("get_jobs is called")

    if not target and re.search("^(colabfold|alphafold2)$", target):
        raise ValueError()

    data = run_shellscript(f"python3 /fsx/{target}/scripts/job_list.py")
    logger.info(data)
    if not data:
        raise NotFoundError()

    return make_response(data)


@router.post("/<target>/jobs")
def post_job(target):
    logger.info("post_job is called")

    try:
        payload = router.current_event.json_body
    except Exception:
        raise ValueError()

    if "fasta" not in payload:
        raise ValueError()

    if not target and re.search("^(colabfold|alphafold2)$", target):
        raise ValueError()

    fastaPath = os.path.join(target, "job", "input")
    fastaFileName = str(uuid.uuid4()) + ".fasta"

    logger.info(os.path.join(fastaPath, fastaFileName))

    s3.put_object(
        Bucket=s3_bucket_name,
        Key=os.path.join(fastaPath, fastaFileName),
        Body=payload["fasta"],
    )

    ## Workaround: S3 のファイルが同期されるまで待機
    time.sleep(5)

    data = run_shellscript(
        f"python3 /fsx/{target}/scripts/job_create.py {fastaFileName}"
    )
    logger.info(data)
    if not data:
        raise NotFoundError()

    return make_response(data)


@router.get("/<target>/jobs/<job_id>")
def get_job(target, job_id):
    logger.info("get_job is called")

    if not job_id and re.search("^[0-9]{1,20}$", job_id):
        raise ValueError()

    if not target and re.search("^(colabfold|alphafold2)$", target):
        raise ValueError()

    data = run_shellscript(f"python3 /fsx/{target}/scripts/job_get.py {job_id}")
    logger.info(data)
    if not data:
        raise NotFoundError()

    try:
        objects = s3.list_objects_v2(
            Bucket=s3_bucket_name,
            Prefix=f"{target}/job/{job_id}/output/",
        )["Contents"]

        keys = [ i["Key"] for i in list(filter(lambda o: re.search("\\.pdb$", o["Key"]), objects)) ]

        # choose the prediction with highest confidence
        params = {"Bucket": s3_bucket_name, "Key": sorted(keys)[0]}

        s3.head_object(Bucket=params["Bucket"], Key=params["Key"])
        data["pdb_url"] = s3.generate_presigned_url(
            ClientMethod="get_object", Params=params, ExpiresIn=3600, HttpMethod="GET"
        )
    except:
        pass

    return make_response(data)


@router.delete("/<target>/jobs/<job_id>")
def delete_job(target, job_id):
    logger.info("delete_job is called")

    if not job_id and re.search("^[0-9]{1,20}$", job_id):
        raise ValueError()

    if not target and re.search("^(colabfold|alphafold2)$", target):
        raise ValueError()

    data = run_shellscript(f"python3 /fsx/{target}/scripts/job_delete.py {job_id}")
    logger.info(data)
    if not data:
        raise NotFoundError()

    return make_response(status_code=HTTPStatus.NO_CONTENT)
