import json
import os
import subprocess
import sys
import uuid

args = sys.argv
output = {"cpu_job_id": "", "gpu_job_id": "", "error": "", "fastaPath": ""}
stderr = ""

# fasta ファイルが渡されたかチェック
if len(args) != 2:
    stderr += "Error: there's no fasta file input"
    output["error"] = stderr
    print(json.dumps(output))

# 指定された fasta ファイルが input 配下に配置されているかチェック
elif not os.path.isfile("/fsx/alphafold2/job/input/" + args[1]):
    stderr += "Error: there's no fasta file in /input directory"
    output["error"] = stderr
    print(json.dumps(output))
else:
    # GPU サーチジョブの実行
    gpu_job_command = " ".join(
        [
            "sbatch -p queue-gpu /fsx/alphafold2/scripts/bin/job-gpu-alphafold2-search.sh",
            args[1],
        ]
    )

    gpu_output = subprocess.run(
        [gpu_job_command], shell=True, capture_output=True, text=True
    )

    if gpu_output.returncode != 0:
        stderr += "GPU search job is finished with some errors: " + gpu_output.stderr
        output["error"] = stderr
        print(json.dumps(output))
    else:
        gpu_job_id = gpu_output.stdout.rsplit(" ", 1)[1].strip()

        output["gpu_job_id"] = gpu_job_id.rstrip("\n")
        output["fastaPath"] = args[1]
        output["error"] = stderr

        print(json.dumps(output))
