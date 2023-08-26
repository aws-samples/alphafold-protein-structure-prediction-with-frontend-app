#!/bin/sh
#SBATCH --gpus=1
#SBATCH -N 1
#SBATCH --output /fsx/alphafold2/job/log/slurm_%j.out

AF_PATH=/fsx/alphafold2/alphafold/
DB_PATH=/fsx/alphafold2/database/
OUTPUT_PATH=/fsx/alphafold2/job/${SLURM_JOB_ID}/output/
INPUT_PATH=/fsx/alphafold2/job/input/
INPUT_PATH_COPIED=/fsx/alphafold2/job/${SLURM_JOB_ID}/input/
INPUT_FILE_NO_EXTENSION=$(echo $1 | sed -e s/\.fasta//)
TEMPLATE_DATE=$(date '+%Y-%m-%d')
mkdir -p $OUTPUT_PATH
mkdir -p $INPUT_PATH_COPIED
sudo cp ${INPUT_PATH}$1 ${INPUT_PATH_COPIED}

# the following is based on https://github.com/deepmind/alphafold/blob/main/README.md
python3 --version # make sure the version matches the pip version
pip3 install -r ${AF_PATH}docker/requirements.txt --user

# build AlphaFold2 docker image locally
sudo docker build -f ${AF_PATH}docker/Dockerfile -t alphafold ${AF_PATH}

# pass the input FASTA file to the docker container
# $1: full path for input FASTA file
python3 ${AF_PATH}docker/run_docker.py \
        --fasta_paths=${INPUT_PATH}$1 \
        --max_template_date=$TEMPLATE_DATE \
        --data_dir=$DB_PATH \
        --output_dir=$OUTPUT_PATH \
        --docker_user=0

# job_get.py searches $OUTPUT_PATH
sudo mv ${OUTPUT_PATH}${INPUT_FILE_NO_EXTENSION}/* ${OUTPUT_PATH}