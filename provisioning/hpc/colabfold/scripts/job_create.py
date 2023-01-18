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
elif not os.path.isfile("/fsx/colabfold/job/input/" + args[1]):
    stderr += "Error: there's no fasta file in /input directory"
    output["error"] = stderr
    print(json.dumps(output))
else:
    fasta_fullpath = "/fsx/colabfold/job/input/" + args[1]

    # テンポラリディレクトリの準備
    dirname = str(uuid.uuid4())
    tmpdir = "/fsx/colabfold/tmp/" + dirname
    msasdir = tmpdir + "/msas"
    os.makedirs(msasdir)

    # CPU サーチジョブの実行
    cpu_job_command = " ".join(
        [
            "sbatch -p queue-cpu /fsx/colabfold/scripts/bin/job-cpu-colabfold-search.sh",
            fasta_fullpath,
            msasdir,
        ]
    )

    cpu_output = subprocess.run(
        [cpu_job_command], shell=True, capture_output=True, text=True
    )

    if cpu_output.returncode != 0:
        stderr += "CPU search job is finished with some errors: " + cpu_output.stderr
        output["error"] = stderr
        print(json.dumps(output))
    else:
        cpu_job_id = cpu_output.stdout.rsplit(" ", 1)[1].strip()

        # GPU バッチジョブを実行
        gpu_job_command = " ".join(
            [
                "sbatch -p queue-gpu",
                "--dependency=afterok:" + cpu_job_id,
                "--kill-on-invalid-dep=yes",
                "/fsx/colabfold/scripts/bin/job-gpu-colabfold-batch.sh",
                cpu_job_id,
                tmpdir,
            ]
        )

        gpu_output = subprocess.run(
            [gpu_job_command], shell=True, capture_output=True, text=True
        )

        if gpu_output.returncode != 0:
            stderr += "GPU batch job is finished with some errors: " + gpu_output.stderr
            output["error"] = stderr
            print(json.dumps(output))
        else:
            gpu_job_id = gpu_output.stdout.rsplit(" ", 1)[1]

            output["cpu_job_id"] = cpu_job_id.rstrip("\n")
            output["gpu_job_id"] = gpu_job_id.rstrip("\n")
            output["error"] = stderr
            output["fastaPath"] = args[1]

            print(json.dumps(output))
