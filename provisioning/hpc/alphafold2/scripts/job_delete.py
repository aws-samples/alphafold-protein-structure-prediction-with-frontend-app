import json
import subprocess
import sys

args = sys.argv
output = {"error": ""}
stderr = ""

# Job ID が渡されたかチェック
if len(args) != 2:
    stderr += "Error: there's no job id input"
    output["error"] = stderr
    print(json.dumps(output))

else:
    # Job のキャンセル処理
    cancel_job_command = " ".join(["scancel", args[1]])
    cancel_output = subprocess.run(
        [cancel_job_command], shell=True, capture_output=True, text=True
    )

    if cancel_output.returncode != 0:
        stderr += "Cancel job is finished with some errors: " + cancel_output.stderr
        output["error"] = stderr
        print(json.dumps(output))
    else:
        output["error"] = ""
        print(json.dumps(output))
