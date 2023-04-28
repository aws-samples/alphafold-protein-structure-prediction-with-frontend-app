# AlphaFold2 Webapp on AWS

View this page in [English](README.md)

AlphaFold2 Webapp on AWS は、ユーザが GUI で AlphaFold2 または ColabFold を実行できるウェブアプリケーション環境を提供します。管理者は AlphaFold2 や ColabFold の解析環境を AWS CDK を用いて簡単に構築することができます。

<img src="doc/webui.png" width=500>

<img src="doc/architecture.png" width=500>

## 開発環境の前提条件

**NOTE**: 次のセクションに記載されている手順に従って開発環境をセットアップすることをおすすめします。

- [AWS CLI のインストール](https://docs.aws.amazon.com/ja_jp/cli/latest/userguide/install-cliv2.html) および [認証情報の設定](https://docs.aws.amazon.com/ja_jp/cli/latest/userguide/cli-configure-files.html)
- [Python 3](https://www.python.org/about/) のインストール
- [Node.js LTS](https://nodejs.org/en/) のインストール
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) のインストール

## AWS Cloud9 を使って開発環境を構築

**NOTE**: AWS Cloud9 環境は `us-east-1` (N. Virginia) リージョンに作成してください。

**NOTE**: この手順を使って開発環境を準備する場合は、上記の必要なソフトウェア (AWS CLI / Python / Node.js / Docker 等) は Cloud9 に初めからインストールされています。

1. [AWS CloudShell](https://docs.aws.amazon.com/cloudshell/latest/userguide/welcome.html) を起動して下記コマンドを実行

```sh
git clone https://github.com/aws-samples/cloud9-setup-for-prototyping
cd cloud9-setup-for-prototyping
```

2. Cloud9 に Elastic IP を付与するため、`vim params.json` で params.json を編集し、`attach_eip` オプションを `true` に変更します。

```diff
  "volume_size": 128,
- "attach_eip": false
+ "attach_eip": true
}
```

3. Cloud9 環境 "cloud9-for-prototyping" を構築します

```sh
./bin/bootstrap
```

**NOTE:** bootstrap の完了時に Cloud9 に付与された Elastic IP が画面上に出力されます。この IP は後ほど参照するため、手元にコピーしておきます。

```
Elastic IP: 127.0.0.1 (例)
```

4. AWS Cloud9 に移動して `cloud9-for-prototyping` を起動
5. `File` から `Upload Local Files` を押下
6. 本リポジトリのソース zip ファイルを `Drag & drop file here` に投下
7. `unzip` コマンドで zip を解凍してディレクトリを移動

```sh
Admin:~/environment $ unzip your_samples.zip
Admin:~/environment $ cd your_samples/
```

## デプロイ手順

**NOTE**: 以降の手順では `us-east-1` (N. Virginia) リージョンを使用します。
**NOTE:** 以降の手順は、上記 Cloud9 環境からの作業を推奨します

### 1. バックエンドの構築

- バックエンドのデプロイ前にフロントエンドをビルドします

```sh
## フロントエンドのビルド
cd app
npm install
npm run build
```

- `provisioning/bin/provisioning.ts` にある `c9Eip` の値を、上述した手順で Cloud9 に付与された Elastic IP アドレス に修正

```diff
-const c9Eip = 'your-cloud9-ip'
+const c9Eip = 'xx.xx.xx.xx'
```

- 修正後、バックエンドを構築します

```sh
cd ../provisioning
npm install
npx cdk bootstrap
## Network, Database, Storage などの構築
npx cdk deploy Alphafold2ServiceStack --require-approval never
cd ../
```

- 上記 CDK の Outputs から Alphafold2ServiceStack.GetSSHKeyCommand の値 `aws ssm get-parameter...` をコピー＆実行して秘密鍵を保存

```sh
aws ssm get-parameter --name /ec2/keypair/key-{任意のID} --region us-east-1 --with-decryption --query Parameter.Value --output text > ~/.ssh/keypair-alphafold2.pem

## 権限の変更
chmod 600 ~/.ssh/keypair-alphafold2.pem
```

### 2. ParallelCluster クラスターの作成

- バックエンドをデプロイしたら、次に ParallelCluster クラスターを作成します
- Cloud9 IDE のターミナルで以下の手順に従ってコマンドを実行します
- config.yml を修正することで、ワークロードに適したインスタンスタイプに変更することができます

```sh
## ParallelCluster コマンドのインストール
pip3 install aws-parallelcluster==3.3.0 --user

## リージョンの設定
export AWS_DEFAULT_REGION=us-east-1

## ParallelCluster を構築するための config.yml を作成
npx ts-node provisioning/hpc/alphafold2/config/generate-template.ts

## ParallelCluster クラスターの作成
pcluster create-cluster --cluster-name hpccluster --cluster-configuration provisioning/hpc/alphafold2/config/config.yml
```

<details>
<summary>ColabFold の場合</summary>
<pre>
npx ts-node provisioning/hpc/colabfold/config/generate-template.ts
</pre>
<pre>
pcluster create-cluster --cluster-name hpccluster --cluster-configuration provisioning/hpc/colabfold/config/config.yml
</pre>
</details>

- クラスターの作成状況は下記コマンドから確認できます

```sh
pcluster list-clusters
```

```json
Output:
{
  "clusters": [
    {
      "clusterName": "hpcclustercolab",
      ## CREATE_COMPLETE になればクラスター作成完了
      "cloudformationStackStatus": "CREATE_COMPLETE",
...
```

### 3. ウェブフロントエンドの構築

```sh
## 下記コマンドでクラスターの HeadNode のインスタンス ID を取得
pcluster describe-cluster -n hpccluster | grep -A 5 headNode | grep instanceId
"instanceId": "i-{任意のID}",
```

- `provisioning/bin/provisioning.ts` にある `ssmInstanceId` の値を上記インスタンス ID に修正

```diff
-const ssmInstanceId = 'your-headnode-instanceid'
+const ssmInstanceId = 'i-{任意のID}'
```

- `provisioning/bin/provisioning.ts` にある `allowIp4Ranges` の値を、フロントエンドへの接続を許可する IP アドレスレンジに修正

```diff
-const allowIp4Ranges = ['your-global-ip-v4-cidr']
+const allowIp4Ranges = ['xx.xx.xx.xx/xx']
```

- 修正後、フロントエンドをデプロイ

```sh
## フロントエンドのデプロイ
cd ~/environment/alphafold-protein-structure-prediction-with-frontend-app/provisioning
npx cdk deploy FrontendStack --require-approval never
```

- `cdk deploy` の Outputs にある `CloudFrontWebDistributionEndpoint` の値がフロントエンドの URL になります

### 4. HeadNode の構築

```sh
## 秘密鍵を使用して ParallelCluster の HeadNode に SSH ログイン
export AWS_DEFAULT_REGION=us-east-1
pcluster ssh --cluster-name hpccluster -i ~/.ssh/keypair-alphafold2.pem
```

- HeadNode にログインして、AlphaFold2 をインストール

```sh
bash /fsx/alphafold2/scripts/bin/app_install.sh
```

- AlphaFold2 に必要なデータベースをダウンロードします。これには 12時間ほどかかります。実行を開始したら、Cloud9 の画面を閉じても構いません。

```sh
nohup bash /fsx/alphafold2/scripts/bin/setup_database.sh &
```

<details>
<summary>ColabFold の場合</summary>
<pre>
bash /fsx/colabfold/scripts/bin/app_install.sh
sbatch /fsx/colabfold/scripts/setupDatabase.bth
</pre>
</details>

### 5. バックエンドの動作確認

- ParallelCluster の HeadNode からログアウトしてしまった場合は、再度ログインします

```sh
## SSH login to ParallelCluster's HeadNode using private key
export AWS_DEFAULT_REGION=us-east-1
pcluster ssh --cluster-name hpccluster -i ~/.ssh/keypair-alphafold2.pem
```

- バックエンドの動作確認をする前に、AlphaFold2 用のデータベースがセットアップ完了しているかを確認します

``` sh
tail /fsx/alphafold2/job/log/setup_database.out -n 10
```

```
Output:
Download Results:
gid   |stat|avg speed  |path/URI
======+====+===========+=======================================================
dcfd44|OK  |    66MiB/s|/fsx/alphafold2/database/pdb_seqres/pdb_seqres.txt

Status Legend:
(OK):download completed.
All data downloaded.
```

- ParallelCluster の HeadNode から下記コマンドでジョブを投入します

```sh
wget -q -P /fsx/alphafold2/job/input/ https://rest.uniprot.org/uniprotkb/Q5VSL9.fasta
python3 /fsx/alphafold2/scripts/job_create.py Q5VSL9.fasta
```

```sh
## squeue コマンドで実行中のジョブを確認
squeue
             JOBID PARTITION     NAME     USER ST       TIME  NODES NODELIST(REASON)
                 1 queue-cpu setupDat   ubuntu CF       0:03      1 queue-cpu-dy-x2iedn16xlarge-1
```

```sh
## 完了するとジョブが表示されなくなる
squeue
             JOBID PARTITION     NAME     USER ST       TIME  NODES NODELIST(REASON)
```

### 6. フロントエンドの動作確認

- フロントエンドでは AlphaFold2 と ColabFold の二種類の画面が表示されますが、実際に動作する画面はどちらか片方のみです。フロントエンド構築時に指定した HeadNode が AlphaFold2 だった場合は AlphaFold2 の画面のみ、ColabFold だった場合は ColabFold の画面のみが動作します。
- 手順 3 で取得したフロントエンドの URL に、ブラウザから接続します。
  - もし URL を忘れてしまった場合は、[AWS Cloudformation のコンソール](https://us-east-1.console.aws.amazon.com/cloudformation) の`FrontendStack` の `出力` タブを見ると、`CloudFrontWebDistributionEndpoint` の値に記載されています。
  - 値は `xxxyyyzzz.cloudfront.net` のような形式です。
- フロントエンドの画面か、ジョブの投入・ジョブ一覧の表示・ジョブの中止・ジョブの結果表示が行えます。

### 7. Clean up

この AWS Samples を試し終わったら、追加の費用が発生しないように不要なリソースを削除します。開発環境の Cloud9 のターミナルから以下のコマンドを実行してください。

- まず、ParallelCluster のクラスターを削除します

```sh
## ParallelCluster のクラスター名の一覧を確認
pcluster list-clusters | grep clusterName
## データベースファイルを削除の上で、クラスターを削除
rm -fr /fsx/alphafold2/database/
pcluster delete-cluster -n {your cluster name}
```

- CDK スタックを削除します

```sh
## CDK スタックの名称を確認の上、それぞれ削除
cd ~/environment/alphafold-protein-structure-prediction-with-frontend-app/provisioning
npx cdk list
npx cdk destroy FrontendStack
npx cdk destroy GlobalStack
npx cdk destroy Alphafold2ServiceStack
```

- 最後に、開発環境である Cloud9 環境を削除してください