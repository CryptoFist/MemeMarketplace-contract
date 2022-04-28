const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deploy, deployProxy, getAt } = require('../scripts/utils');

const bigNum = num=>(num + '0'.repeat(18))
const smallNum = num=>(parseInt(num)/bigNum(1))
const zeroAddress = '0x0000000000000000000000000000000000000000';
const tokenURIs = [
   'https://gateway.pinata.cloud/ipfs/QmfUk1XLTrgQmbjwGw7sKa1DggNeZoYtk5JD4n4bq1eRHk',
   'https://gateway.pinata.cloud/ipfs/QmRGyvR1PBhjBXmkMxrtHHfYH7uoctT7XAqkc1GiA52sBe',
   'https://gateway.pinata.cloud/ipfs/QmUgUiJNAPiH9sUhhkjrJxRcwhjchVsbzNdu5umrJgAEhk',
   'https://gateway.pinata.cloud/ipfs/QmTnH7cmFiQdWWpUnKMdUqEWZNVESrqbKUu8f496CCqe22',
   'https://gateway.pinata.cloud/ipfs/QmXXaQj5TTocKDdnDbYguUS4BiQDqrtKjHVPUdcYtUMmpU',
   'https://gateway.pinata.cloud/ipfs/QmPzY59ajxEEwVwMakqj7zkLMAMCEu4vUEvQATCuZ1CeLB'
]

const AUCTION_TYPE_SALE = 0;
const AUCTION_TYPE_NORMAL = 1;
const AUCTION_TYPE_TIME = 2;
const AUCTION_TYPE_SLIENT = 3;

describe('Sale & MakerOffer: MakeOffer', function () {
   before (async function () {
      [
         this.minter1,
         this.minter2,
         this.bider1,
         this.bider2,
         this.multisig
      ] = await ethers.getSigners();

      this.WETH = await deploy("ERC20Mock",'Wrapped ETH', 'WETH');
      this.revFactory = await deployProxy('RevFactory');
      this.saleNFT = await deployProxy('RevSale');
      this.revNFT = await deploy('RevNFT', 'Rev NFT', 'RNT', BigInt(10 ** 15));
      this.auction = await deployProxy('RevAuction');
      this.marketPlace = await deployProxy('MarketPlace');
      this.marketPlaceRouter = await deployProxy('MarketPlaceRouter');

      await this.marketPlaceRouter.setBasicData(
         this.marketPlace.address,
         this.auction.address,
         this.saleNFT.address,
         this.revNFT.address,
         this.revFactory.address
      );

      await this.marketPlace.setData(
         this.auction.address,
         this.saleNFT.address,
         this.revNFT.address,
         this.WETH.address
      );

      await this.marketPlace.setOwner(this.marketPlaceRouter.address);

      await this.auction.setOwner(
         this.marketPlace.address,
         this.marketPlaceRouter.address
      );
      await this.saleNFT.setOwner(
         this.marketPlace.address,
         this.marketPlaceRouter.address
      );

      await this.revNFT.setMarketplaceAddress(this.marketPlaceRouter.address);

      this.nftFactory = await ethers.getContractFactory('TestNFT');
      this.nft1 = await this.nftFactory.deploy('nft1', 'NFT1', bigNum('1'));
      await this.nft1.deployed();
      this.nft2 = await this.nftFactory.deploy('nft2', 'NFT2', bigNum('1'));
      await this.nft2.deployed();

      await this.WETH.approve(this.minter2.address, bigNum(10000000));
      await this.WETH.approve(this.bider1.address, bigNum(10000000));
      await this.WETH.approve(this.bider2.address, bigNum(10000000));

      await this.WETH.transfer(this.minter2.address, bigNum(10000));
      await this.WETH.transfer(this.bider1.address, bigNum(10000));
      await this.WETH.transfer(this.bider2.address, bigNum(10000));
   })

   it ('mint collection', async function () {
      for (let i = 0; i < 4; i ++) {
         await this.nft1.createNFT([tokenURIs[i]], {value: bigNum(1)});
         await this.nft2.connect(this.minter2).createNFT([tokenURIs[i]], {value: bigNum(1)});
         await this.marketPlaceRouter.addCollection(this.nft1.address, [i]);
      }
   })

   it ('List for sale and buy', async function () {
      this.tokenID = 0;
      await this.nft1.setApprovalForAll(this.marketPlace.address, true);

      let saleList = await this.marketPlaceRouter.getTokensForSale();
      expect(saleList.length).to.equal(0);
      await this.marketPlaceRouter.connect(this.minter1).listNFTForSale(
         this.nft1.address,
         [this.tokenID],
         bigNum(2)
      );

      saleList = await this.marketPlaceRouter.getTokensForSale();
      expect(saleList.length).to.equal(1);

      let tokenDetail = await this.marketPlaceRouter.getTokenDetail(this.nft1.address, this.tokenID);
      this.sellID = tokenDetail.sellID;
      await this.marketPlaceRouter.connect(this.minter1).closeSale(saleList[0].sellID);
      saleList = await this.marketPlaceRouter.getTokensForSale();
      expect(saleList.length).to.equal(0);

      await this.marketPlaceRouter.connect(this.minter1).listNFTForSale(
         this.nft1.address,
         [this.tokenID],
         bigNum(2)
      );

      tokenDetail = await this.marketPlaceRouter.getTokenDetail(this.nft1.address, this.tokenID);
      this.sellID = tokenDetail.sellID;
      await this.marketPlaceRouter.connect(this.bider1).buyNFTs(
         this.sellID,
         {value: bigNum(2)}
      );

      await this.nft1.connect(this.bider1).approve(this.marketPlace.address, this.tokenID);

      await this.marketPlaceRouter.connect(this.bider1).listNFTForSale(
         this.nft1.address,
         [this.tokenID],
         bigNum(5)
      );

      let details = await this.marketPlaceRouter.getTokenDetail(this.nft1.address, this.tokenID);
      expect(details.forSale).to.equal(true);
      expect(details.price).to.equal(bigNum(5));

      this.sellID = details.sellID;
      await this.marketPlaceRouter.connect(this.minter1).buyNFTs(
         this.sellID,
         {value: bigNum(5)}
      );

      let tokens = await this.marketPlaceRouter.getAllTokens();
      expect(smallNum(tokens[0].price)).to.equal(3.5);

      details = await this.marketPlaceRouter.getTokenDetail(this.nft1.address, this.tokenID);
      expect(details.forSale).to.equal(false);
      expect(smallNum(details.price)).to.equal(3.5);

      this.tokenID = 0;
      await this.marketPlaceRouter.connect(this.minter2).addCollection(this.nft2.address, [this.tokenID]);
      await this.nft2.connect(this.minter2).approve(this.marketPlace.address, this.tokenID);

      await this.marketPlaceRouter.connect(this.minter2).listNFTForSale(
         this.nft2.address,
         [this.tokenID],
         bigNum(3)
      );

      tokenDetail = await this.marketPlaceRouter.getTokenDetail(this.nft2.address, this.tokenID);
      this.sellID = tokenDetail.sellID;
      await this.marketPlaceRouter.connect(this.bider2).buyNFTs(
         this.sellID,
         {value: bigNum(3)}
      );

      await this.nft2.connect(this.bider2).approve(this.marketPlace.address, this.tokenID);

      await this.marketPlaceRouter.connect(this.bider2).listNFTForSale(
         this.nft2.address,
         [this.tokenID],
         bigNum(6)
      );

      tokenDetail = await this.marketPlaceRouter.getTokenDetail(this.nft2.address, this.tokenID);
      this.sellID = tokenDetail.sellID;

      await this.marketPlaceRouter.connect(this.minter2).buyNFTs(
         this.sellID,
         {value: bigNum(6)}
      );

      tokens = await this.marketPlaceRouter.getAllTokens();
      expect(smallNum(tokens[4].price)).to.equal(4.5);
   })

   it ('make Offer', async function () {
      await this.nft1.approve(this.marketPlace.address, 0);
      await this.WETH.connect(this.minter1).approve(this.marketPlace.address, bigNum(1));
      await this.marketPlaceRouter.connect(this.minter1).makeOffer(
         [
            {
               tokenAddress: this.nft2.address,
               tokenID: 0
            },
            {
               tokenAddress: this.nft1.address,
               tokenID: 0
            }
         ], 
         0,
         bigNum(1)
      );

      await this.WETH.connect(this.bider1).approve(this.marketPlace.address, bigNum(3));
      await this.marketPlaceRouter.connect(this.bider1).makeOffer(
         [
            {
               tokenAddress: this.nft2.address,
               tokenID: 0
            }
         ], 
         0,
         bigNum(3)
      );

      let details = await this.marketPlaceRouter.getTokenDetail(this.nft2.address, 0);
      expect(details.offerCount).to.equal(2);
      expect(details.offers.length).to.equal(2);

      let tokens = await this.marketPlaceRouter.getAllTokens();
      expect(tokens[4].offers.length).to.equal(2);
   })

   it ('accept offer', async function () {
      await this.nft2.connect(this.minter2).approve(this.marketPlace.address, 0);
      await this.WETH.connect(this.minter2).approve(this.marketPlace.address, bigNum(1));
      await this.marketPlaceRouter.connect(this.minter2).acceptOffer(
         {
            tokenAddress: this.nft2.address,
            tokenID: 0
         },
         0, 
         bigNum(1)
      );

      let details = await this.marketPlaceRouter.getTokenDetail(this.nft2.address, 0);
      expect(details.offerCount).to.equal(0);
      expect(details.offers.length).to.equal(0);
   })

   it ('list sale and check price', async function () {
      let tokens = await this.marketPlaceRouter.getTokensByOwner(this.minter1.address);
      await this.nft2.setApprovalForAll(this.marketPlace.address, true);
      await this.marketPlaceRouter.listNFTForSale(this.nft2.address, [0], bigNum('7'));

      tokens = await this.marketPlaceRouter.getTokensByOwner(this.minter1.address);
      expect(smallNum(tokens[3].price)).to.equal(7);
      this.sellID ++;
   })

   it ('buy NFT', async function () {
      const saleList = await this.marketPlaceRouter.getTokensForSale();
      await this.marketPlaceRouter.connect(this.bider1).buyNFTs(saleList[0].sellID, {value: bigNum(7)});
      tokens = await this.marketPlaceRouter.getTokensByOwner(this.bider1.address);
      expect(smallNum(tokens[0].price)).to.equal(4.25);
   })

   it ('get sale history of token', async function () {
      const saleHistory = await this.marketPlaceRouter.getSaleHistory(this.nft1.address, 0);    
      expect(saleHistory.length).to.equal(2);
   })

   it ('list sale and try to buy', async function () {
      let tokens = await this.marketPlaceRouter.getTokensByOwner(this.minter1.address);
      await this.nft1.setApprovalForAll(this.marketPlace.address, true);
      await this.marketPlaceRouter.listNFTForSale(this.nft1.address, [1], bigNum('7'));
      await this.marketPlaceRouter.listNFTForSale(this.nft1.address, [2], bigNum('8'));

      await this.WETH.connect(this.minter2).approve(this.marketPlace.address, bigNum(3));
      await this.marketPlaceRouter.connect(this.minter2).makeOffer(
         [
            {
               tokenAddress: this.nft1.address,
               tokenID: 1
            }
         ],
         0,
         bigNum(3)
      );

      let tokenDetail = await this.marketPlaceRouter.getTokenDetail(this.nft1.address, 1);
      await this.marketPlaceRouter.connect(this.bider1).buyNFTs(tokenDetail.sellID, {value: bigNum(7)});

      tokenDetail = await this.marketPlaceRouter.getTokenDetail(this.nft1.address, 2);
      await this.marketPlaceRouter.connect(this.bider1).buyNFTs(tokenDetail.sellID, {value: bigNum(8)});
   })

   it ('accept offer', async function () {
      await this.nft1.connect(this.bider1).approve(this.marketPlace.address, 1);
      await this.marketPlaceRouter.connect(this.bider1).acceptOffer(
         {
            tokenAddress: this.nft1.address,
            tokenID: 1
         },
         0,
         0
      );
   })

   it ('list sale and try to buy', async function () {
      let tokens = await this.marketPlaceRouter.getTokensByOwner(this.bider1.address);
      await this.nft1.connect(this.bider1).setApprovalForAll(this.marketPlace.address, true);
      await this.marketPlaceRouter.connect(this.bider1).listNFTForSale(this.nft1.address, [2], bigNum('7'));

      let saleInfos = await this.marketPlaceRouter.getTokensForSale();
      this.sellID = saleInfos[saleInfos.length - 1].sellID;
      await this.marketPlaceRouter.connect(this.bider1).changeSalePrice(this.sellID, bigNum(8));
      saleInfos = await this.marketPlaceRouter.getTokensForSale();
      expect(saleInfos[saleInfos.length - 1].price).to.equal(bigNum(8));

      const tokenDetail = await this.marketPlaceRouter.getTokenDetail(
         saleInfos[saleInfos.length - 1].tokenAddress,
         saleInfos[saleInfos.length - 1].tokenIDs[0]
      );
      expect(tokenDetail.price).to.equal(bigNum(8));

      await this.nft1.connect(this.bider1).setApprovalForAll(this.marketPlace.address, true);
      await this.marketPlaceRouter.connect(this.bider1).listAuction(
         this.nft1.address,
         [2],
         AUCTION_TYPE_NORMAL,
         bigNum(1),
         0
      );

      let auctions = await this.marketPlaceRouter.getAuctionList();
      const auctionID = auctions[auctions.length - 1].auctionID;
      await expect(
         this.marketPlaceRouter.connect(this.bider2).changeAuctionPrice(
            auctionID,
            bigNum(2)
         )
      ).revertedWith('not owner');
      await this.marketPlaceRouter.connect(this.bider1).changeAuctionPrice(
         auctionID,
         bigNum(2)
      );
      auctions = await this.marketPlaceRouter.getAuctionList();
      expect(auctions[0].price).to.equal(bigNum(2));
      
      await this.WETH.connect(this.bider2).approve(this.marketPlace.address, bigNum(4));
      await this.marketPlaceRouter.connect(this.bider2).bidAuction(
         auctionID,
         bigNum(4)
      );

      const sales = await this.marketPlaceRouter.getTokensForSale();
      const sellID = sales[0].sellID;

      await this.marketPlaceRouter.connect(this.minter1).buyNFTs(
         sellID,
         {value: bigNum(8)}
      );
   })
})