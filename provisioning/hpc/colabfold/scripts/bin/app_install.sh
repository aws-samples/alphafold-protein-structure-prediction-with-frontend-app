#####
# /fsx 下の user:group 変更
#####
sudo chown -R ubuntu:ubuntu /fsx

#####
# MMseqs2インストール
#####
rm -fr /fsx/mmseqs2
mkdir -p /fsx/mmseqs2/src
cd /fsx/mmseqs2/src
git clone --depth=1 https://github.com/soedinglab/MMseqs2.git
cd /fsx/mmseqs2/src/MMseqs2
mkdir build
cd build
cmake -DCMAKE_BUILD_TYPE=RELEASE -DHAVE_AVX2=1 -DHAVE_MPI=0 -DCMAKE_INSTALL_PREFIX=/fsx/mmseqs2/ ..
make -j 4
make install
echo "export PATH=\$PATH:/fsx/mmseqs2/bin" >> /home/ubuntu/.bashrc

#####
# vmtouch インストール
#####
rm -fr /fsx/vmtouch
cd /fsx
git clone https://github.com/hoytech/vmtouch.git
cd vmtouch
make
sudo make install

#####
# ColabFold インストール
#####
cd /fsx/colabfold
CURRENTPATH=`pwd`
COLABFOLDDIR="${CURRENTPATH}/colabfold_install"
rm -fr ${COLABFOLDDIR}
mkdir -p ${COLABFOLDDIR}
cd ${COLABFOLDDIR}
wget -q -P . https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh
bash ./Miniconda3-latest-Linux-x86_64.sh -b -p ${COLABFOLDDIR}/conda
rm Miniconda3-latest-Linux-x86_64.sh
. "${COLABFOLDDIR}/conda/etc/profile.d/conda.sh"
conda create -p $COLABFOLDDIR/colabfold-conda python=3.7 -y
conda activate $COLABFOLDDIR/colabfold-conda
conda update -n base conda -y
conda install -c conda-forge python=3.7 cudnn==8.2.1.32 cudatoolkit==11.1.1 openmm==7.5.1 pdbfixer -y
conda install -c conda-forge -c bioconda kalign3=3.2.2 hhsuite=3.3.0 -y
colabfold-conda/bin/python3.7 -m pip install "colabfold[alphafold] @ git+https://github.com/sokrypton/ColabFold"
colabfold-conda/bin/python3.7 -m pip install https://storage.googleapis.com/jax-releases/cuda11/jaxlib-0.3.10+cuda11.cudnn82-cp37-none-manylinux2014_x86_64.whl
colabfold-conda/bin/python3.7 -m pip install jax==0.3.13
mkdir -p /fsx/colabfold/job

wget -q -P /fsx/colabfold/scripts/bin/ https://raw.githubusercontent.com/sokrypton/ColabFold/main/setup_databases.sh
chmod u+x /fsx/colabfold/scripts/bin/setup_databases.sh
cat > /fsx/colabfold/scripts/setupDatabase.bth <<EOF
#!/bin/bash
mkdir /fsx/colabfold/database
/fsx/colabfold/scripts/bin/setup_databases.sh /fsx/colabfold/database
EOF
