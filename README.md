# AlphaFold2 Webapp on AWS

View this page in [Japanese(日本語)](README_ja.md)

AlphaFold2 Webapp on AWS provides a web frontend that allows users to run AlphaFold2 or ColabFold using GUI. In addition, administrators can easily build an AlphaFold2 or ColabFold analysis environment with AWS CDK.

<img src="doc/webui.png" width=500>

<img src="doc/architecture.png" width=500>

## Prerequisites for development environment

**NOTE**: We recommend that you follow the steps in the next section to set up your development environment.

- Install [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html) and [Set configuration and credentials](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html)
- Install [Python 3](https://www.python.org/about/)
- Install [Node.js LTS](https://nodejs.org/en/)
- Install [Docker Desktop](https://www.docker.com/products/docker-desktop/)

## Set up your development environment using AWS Cloud9

**NOTE**: We recommend you create your AWS Cloud9 environment in `us-east-1` (N. Virginia) region.

**NOTE**: If you are going to create an AWS Cloud9 environment using the following commands, the prerequisites above (e.g. AWS CLI / Python / Node.js / Docker) are pre-configured at Cloud9.

1. Launch [AWS CloudShell](https://docs.aws.amazon.com/cloudshell/latest/userguide/welcome.html) and run the following command.

```sh
git clone https://github.com/aws-samples/cloud9-setup-for-prototyping
cd cloud9-setup-for-prototyping
## Launch Cloud9 environment "cloud9-for-prototyping"
./bin/bootstrap
```

1. Open the [AWS Cloud9 console](https://console.aws.amazon.com/cloud9/), and open an environment named `cloud9-for-prototyping`.
1. On the menu bar at the top of the AWS Cloud9 IDE, choose `Window` > `New Terminal` or use an existing terminal window.
1. In the terminal window, enter the following.

```sh
git clone https://github.com/aws-samples/alphafold-protein-structure-prediction-with-frontend-app.git
```

1. Go to `alphafold-protein-structure-prediction-with-frontend-app` directory.

```sh
cd alphafold-protein-structure-prediction-with-frontend-app/
```

## Deploy the application

**NOTE**: The following command uses `us-east-1` (N. Virginia) region.

**NOTE**: We recommend that you use the Cloud9 environment for the following steps.

### 1. Backend

- Before deploying backend CDK stack, you need to build frontend CDK stack. In the terminal window of Cloud9 IDE, enter the following.
```sh
## Build the frontend CDK stack
cd app
npm install
npm run build
```

- In `provisioning/bin/provisioning.ts`, modify  the value of `c9Eip` to Cloud9 public IP address. 

```diff
-  c9Eip: 'your-cloud9-ip'
+  c9Eip: 'xx.xx.xx.xx'
```

- After the modification, deploy backend CDK stack.
```sh
cd ../provisioning
npm install
npx cdk bootstrap
## Set up the network, database, and storage 
npx cdk deploy Alphafold2ServiceStack --require-approval never
cd ../
```

- After finishing the above command, you will see the output like below.
  - If you miss out these outputs, you can check them from the outputs tab of the stack named `AlphaFold2ServiceStack` at [AWS Cloudformation Console](https://us-east-1.console.aws.amazon.com/cloudformation).

```
Output:
Alphafold2ServiceStack.AuroraCredentialSecretArn = arn:aws:secretsmanager:us-east-1:123456789012:secret:AuroraCredentialSecretxxxyyyzzz
Alphafold2ServiceStack.AuroraPasswordArn = arn:aws:secretsmanager:us-east-1:123456789012:secret:AuroraPasswordxxxyyyzzz
Alphafold2ServiceStack.ExportsOutputRefHpcBucketxxxyyyzzz = alphafold2servicestack-hpcbucketxxxyyyzzz
Alphafold2ServiceStack.FsxFileSystemId = fs-xxxyyyzzz
Alphafold2ServiceStack.GetSSHKeyCommand = aws ssm get-parameter --name /ec2/keypair/key-xxxyyyzzz --region us-east-1 --with-decryption --query Parameter.Value --output text > ~/.ssh/keypair-alphafold2.pem
...
```

- From the outputs above, copy the value of Alphafold2ServiceStack.GetSSHKeyCommand `aws ssm get-parameter ...` and enter it to Cloud9 terminal. 
  - This command fetches the private key and saves it to Cloud9.

```sh
aws ssm get-parameter --name /ec2/keypair/key-{your key ID} --region us-east-1 --with-decryption --query Parameter.Value --output text > ~/.ssh/keypair-alphafold2.pem
## change the access mode of private key
chmod 600 ~/.ssh/keypair-alphafold2.pem
```

### 2. Set up a cluster managed by AWS ParallelCluster

- Now that the backend has been built, the next step is to create clusters for protein structure prediction.
- In the Cloud9 IDE terminal, enter the following. 
- You can modify config.yml to change instance type which is appropriate to your workload. 

**NOTE**: The following includes commands for both AlphaFold2 and ColabFold. Choose one that you prefer.

```sh
## Install AWS ParallelCluster CLI
pip3 install aws-parallelcluster==3.3.0 --user
## Set the default region
export AWS_DEFAULT_REGION=us-east-1

## Generate a configuration file for a ParallelCluster cluster
### For ColabFold 
npx ts-node provisioning/hpc/colabfold/config/generate-template.ts
### For AlphaFold2
npx ts-node provisioning/hpc/alphafold2/config/generate-template.ts

## Create a ParallelCluster cluster
### For ColabFold
pcluster create-cluster --cluster-name hpccluster --cluster-configuration provisioning/hpc/colabfold/config/config.yml
### For AlphaFold2
pcluster create-cluster --cluster-name hpccluster --cluster-configuration provisioning/hpc/alphafold2/config/config.yml
```

- You can check the cluster creation status using the following command.

```sh
pcluster list-clusters
```

```
Output: 
{
  "clusters": [
    {
      "clusterName": "hpccluster",
      ## Wait until CREATE_COMPLETE 
      "cloudformationStackStatus": "CREATE_COMPLETE",
...
```

### 3. Web frontend

- Create a web frontend and connect it to the cluster we just created in the previous step.
- In the terminal of Cloud9 IDE, enter the following.

```sh
## Get the instance ID of the cluster's HeadNode
pcluster describe-cluster -n hpccluster | grep -A 5 headNode | grep instanceId
```
```
Output:
"instanceId": "i-{your instance ID}",
```

- In `provisioning/bin/provisioning.ts`, modify  the value of `ssmInstanceId` to what we have just fetched in the previous step.

```diff
-  ssmInstanceId: 'your-headnode-instanceid',
+  ssmInstanceId: 'i-{your instance ID}',
```

- After the modification, deploy the frontend CDK stack.

```sh
## Deploy the frontend CDK stack
cd provisioning
npx cdk deploy FrontendStack --require-approval never
```

- After finishing the command above, you will see the outputs similar to the following.
  - The value of `CloudFrontWebDistributionEndpoint` shows the URL of the frontend environment.
  - If you miss out these outputs, you can check them from the outputs tab of the stack named `FrontendStack` at [AWS Cloudformation Console](https://us-east-1.console.aws.amazon.com/cloudformation).

```
Output:
FrontendStack.ApiGatewayEndpoint = https://xxxyyyzzz.execute-api.us-east-1.amazonaws.com/api
FrontendStack.ApiRestApiEndpointXXYYZZ = https://xxxyyyzzz.execute-api.us-east-1.amazonaws.com/api/
FrontendStack.CloudFrontWebDistributionEndpoint = xxxyyyzzz.cloudfront.net
```

### 4. Launch a HeadNode in your cluster

```sh
## SSH login to ParallelCluster's HeadNode using private key
export AWS_DEFAULT_REGION=us-east-1
pcluster ssh --cluster-name hpccluster -i ~/.ssh/keypair-alphafold2.pem
```

- Once you logged into the headnode of the ParallelCluster cluster, install the software of your preference (ColabFold or AlphaFold2).

**NOTE**: The following commands include both for ColabFold and AlphaFold2. Choose the one you prefer.

```sh
## Install the software of your choice
### For ColabFold
bash /fsx/colabfold/scripts/bin/app_install.sh
### For AlphaFold2
bash /fsx/alphafold2/scripts/bin/app_install.sh
```

- Create a database for ColabFold or AlphaFold2. Both cases take several hours to complete. Once you started the job, it is safe to close the terminal.

```sh
## Create database for the software of your choice
### For ColabFold
sbatch /fsx/colabfold/scripts/setupDatabase.bth
### For AlphaFold2
bash /fsx/alphafold2/scripts/bin/setup_database.sh
```

### 5. Check if the backend works

- Submit jobs from ParallelCluster's HeadNode with the following commands

```sh
## Fetch the FASTA file of your choice (e.g. Q5VSL9)
wget -q -P /fsx/colabfold/job/input/ https://rest.uniprot.org/uniprotkb/Q5VSL9.fasta

## Start the job using CLI
### For ColabFold
python3 /fsx/colabfold/scripts/job_create.py Q5VSL9.fasta
### For AlphaFold2
python3 /fsx/alphafold2/scripts/job_create.py Q5VSL9.fasta
```

- Check the job status with the following command.

```sh
squeue
```
```
Output: 
## While running a job
             JOBID PARTITION     NAME     USER ST       TIME  NODES NODELIST(REASON)
                 1 queue-cpu setupDat   ubuntu CF       0:03      1 queue-cpu-dy-x2iedn16xlarge-1

## Once all the jobs finished
             JOBID PARTITION     NAME     USER ST       TIME  NODES NODELIST(REASON)
```

### 6. Check if the frontend works

- Access the frontend URL that you obtained in [step 3](#3-web-frontend).
  - If you forgot the URL, you can check it from the value of `CloudFrontWebDistributionEndpoint` at the outputs tab of the stack named `FrontendStack` at [AWS Cloudformation Console](https://us-east-1.console.aws.amazon.com/cloudformation).
  - It looks like `xxxyyyzzz.cloudfront.net`.
- From the frontend, you can submit a job, list recent jobs, cancel a job, and visualize the result of the job.

### 7. Clean up

- When you are done trying out this sample, remove the resource to avoid incurring additional costs.

- First, delete your ParallelCluster cluster.
  ```sh
  ## Get the ParallelCluster cluster name, then delete the cluster.
  pcluster list-clusters | grep clusterName 
  pcluster delete-cluster -n {your cluster name}
  ```

- Delete the CDK stacks.
  ```sh
  ## Check the name of the CDK stacks and destroy them
  cd ~/environment/alphafold-protein-structure-prediction-with-frontend-app/provisioning
  cdk list
  cdk destroy FrontendStack
  cdk destroy Alphafold2ServiceStack
  ```

- If you used Cloud9 for deploying this sample, remove the Cloud9 environment.
  