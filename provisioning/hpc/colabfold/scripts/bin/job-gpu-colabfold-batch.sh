#!/bin/sh
#SBATCH --gpus=1
#SBATCH -N 1

# colabfold_batchを実行
export PATH="/fsx/colabfold/colabfold_install/colabfold-conda/bin:${PATH}"
cd /home/ubuntu
JOBROOT=/fsx/colabfold/job
UNIREFDB=uniref30_2202_db

# $1: SEARCH_JOBID, $2: TEMPORARY_DIR_PATH
mkdir $JOBROOT/$1
mv $2/* $JOBROOT/$1/
export XLA_FLAGS=--xla_gpu_force_compilation_parallelism=1
colabfold_batch  --amber --templates --num-recycle 3 --use-gpu-relax --model-type auto $JOBROOT/$1/msas/ $JOBROOT/$1/output/

# ジョブ完了時に SNS を使ってメールで通知するサンプル
# aws sns publish --subject "ColabFold: Job ID \${$1} Completed" --message "ジョブ完了通知： ジョブID: \${$1} の実行が完了しました" --topic $SNS_TOPIC --region 'us-east-1'