#!/bin/bash

##########
# Post-install script for AWS ParallelCluster head node
# Based on https://github.com/aws-samples/aws-research-workshops/blob/mainline/notebooks/parallelcluster/scripts/pcluster_post_install_fast.sh
##########

# Exit immediately if a command exits with a non-zero status
set -eu
echo "start running post process..."

#####
# Fetch information from CustomActions in ../config/config.yml
#####
FSX_FILE_SYSTEM_ID="$1"
HPC_BUCKET_NAME="$2"

#####
# Associate S3 Bucket to FSx for Lustre
#####
rm /usr/local/bin/aws
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
./aws/install
len=`aws fsx describe-data-repository-associations --filters "Name=file-system-id,Values=${FSX_FILE_SYSTEM_ID}" | jq -r '.Associations | length'`
if [ $len -eq 0 ]; then
    aws fsx create-data-repository-association --file-system-id ${FSX_FILE_SYSTEM_ID} --file-system-path / --data-repository-path s3://${HPC_BUCKET_NAME} --s3 "AutoImportPolicy={Events=[NEW,CHANGED,DELETED]},AutoExportPolicy={Events=[NEW,CHANGED,DELETED]}" --batch-import-meta-data-on-create
fi