/**
 * NFT address is 0x966dC3Fd635f7BE39Ab8162207Fd56A6e884D148
 * RevFactory address is 0x0f0782765FbC636Dc020914E5B7698156904ca25
 * RevSale address is  0x6A439F9a4C3B0a5349108bC29c8b6FD3E85e2567
 * RevAuction address is  0x9D193AFc23EEC7EFB179807B41ec090a5965F8DA
 * marketplace address is  0xF45831366eD2D8E963C8D5671d85BE3b9D9ce0F0
 * router address is 0x20C57729FAFE3F5b0c7c801A38fe43A475dFAB71
 */
 const { parseEther } = require('ethers/lib/utils');
 const { ethers } = require('hardhat');
 const { deploy, deployProxy, getAt, upgradeProxy } = require('./utils');
 
 async function main() {
 
    const [deployer] = await ethers.getSigners();
 
    console.log("Deploying contracts with the account:", deployer.address);
 
    const WETH_address = 0xc778417e063141139fce010982780140aa0cd5ab; // rinkeby

    this.revNFT = await deploy('RevNFT', 'Rev NFT', 'RNT', BigInt(10 ** 15));
    this.revFactory = await getAt('RevFactory', '0x0f0782765FbC636Dc020914E5B7698156904ca25');
    this.saleNFT = await getAt('RevSale', '0x8929FbCa926e9FE9C107E9ca690d1B15ec274B33');
    this.auction = await getAt('RevAuction', '0xC1821A3dD9b73Ce764fe96818615eb8eA6799526');
    this.marketPlace = await getAt('MarketPlace', '0x72c42783aaAF60d2f872E48440bd96B824FA9658');
    this.marketPlaceRouter = await getAt('MarketPlaceRouter', '0xDbf333E9fE0A40A6dB64a3c0BDdbBF5A66F8746d');
 
    console.log('setting basic data...');
 
    await this.marketPlace.setData(
       this.auction.address,
       this.saleNFT.address,
       this.revNFT.address,
       WETH_address
    );
 
    await this.marketPlaceRouter.setBasicData(
       this.marketPlace.address,
       this.auction.address,
       this.saleNFT.address,
       this.revNFT.address,
       this.revFactory.address
    );
    
    await this.revNFT.setMarketplaceAddress(this.marketPlaceRouter.address);
    
    console.log("Deployed successfully!");
 }
 
 main()
   .then(() => process.exit(0))
   .catch((error) => {
     console.error(error);
     process.exit(1);
   });