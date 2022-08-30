import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { of, throwError } from 'rxjs';

// Client
import {
  AccountsService,
  AssetBankModel,
  PricesService
} from '@cybrid/cybrid-api-bank-angular';

// Services
import { AccountService, AssetService, ConfigService } from '@services';

// Utility
import { AssetPipe, MockAssetPipe } from '@pipes';
import { TestConstants } from '@constants';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { HttpLoaderFactory } from '../../../app/modules/library.module';
import { HttpClient } from '@angular/common/http';

describe('AccountService', () => {
  let service: AccountService;
  let MockAccountsService = jasmine.createSpyObj(AccountsService, [
    'listAccounts'
  ]);
  let MockConfigService = jasmine.createSpyObj('ConfigService', ['getConfig$']);
  let MockPricesService = jasmine.createSpyObj(PricesService, ['listPrices']);

  const error$ = throwError(() => {
    new Error('Error');
  });

  class MockAssetService {
    constructor() {}
    getAsset(code: string): AssetBankModel {
      if (code == 'BTC') return TestConstants.BTC_ASSET;
      else if (code == 'ETH') return TestConstants.ETH_ASSET;
      else return TestConstants.USD_ASSET;
    }
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        TranslateModule.forRoot({
          loader: {
            provide: TranslateLoader,
            useFactory: HttpLoaderFactory,
            deps: [HttpClient]
          }
        })
      ],
      providers: [
        { provide: AssetPipe, useClass: MockAssetPipe },
        { provide: AccountsService, useValue: MockAccountsService },
        { provide: PricesService, useValue: MockPricesService },
        { provide: AssetService, useClass: MockAssetService },
        { provide: ConfigService, useValue: MockConfigService }
      ]
    });
    service = TestBed.inject(AccountService);

    // Mocks
    MockAccountsService = TestBed.inject(AccountsService);
    MockAccountsService.listAccounts.and.returnValue(
      of(TestConstants.ACCOUNT_LIST_BANK_MODEL)
    );
    MockConfigService = TestBed.inject(ConfigService);
    MockConfigService.getConfig$.and.returnValue(of(TestConstants.CONFIG));
    MockPricesService = TestBed.inject(PricesService);
    MockPricesService.listPrices.and.returnValue(
      of(TestConstants.SYMBOL_PRICE_BANK_MODEL_ARRAY)
    );
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should filter accounts', () => {
    const filteredAccounts =
      TestConstants.ACCOUNT_LIST_BANK_MODEL.objects.filter((account) => {
        return account.type == 'trading';
      });

    service.filterAccounts().subscribe((accounts) => {
      expect(accounts).toEqual(filteredAccounts);
    });
  });

  it('should filter prices', () => {
    // Test for asset = BTC
    let filteredPrice = TestConstants.SYMBOL_PRICE_BANK_MODEL_ARRAY[0];

    // Call filter prices with BTC AccountBankModel
    let price = service.filterPrices(
      TestConstants.SYMBOL_PRICE_BANK_MODEL_ARRAY,
      TestConstants.ACCOUNT_BANK_MODEL_BTC
    );

    expect(price).toEqual(filteredPrice);

    // Test for asset = ETH
    filteredPrice = TestConstants.SYMBOL_PRICE_BANK_MODEL_ARRAY[1];

    // Call filter prices with ETH AccountBankModel
    price = service.filterPrices(
      TestConstants.SYMBOL_PRICE_BANK_MODEL_ARRAY,
      TestConstants.ACCOUNT_BANK_MODEL_ETH
    );
    expect(price).toEqual(filteredPrice);
  });

  it('should get account assets', () => {
    // Test for asset = BTC
    let assetCodes = ['BTC', 'USD'];

    let assetModels = service.getAccountAssets(assetCodes);
    expect(assetModels).toEqual([
      TestConstants.BTC_ASSET,
      TestConstants.USD_ASSET
    ]);

    // Test for asset = ETH
    assetCodes = ['ETH', 'USD'];

    assetModels = service.getAccountAssets(assetCodes);
    expect(assetModels).toEqual([
      TestConstants.ETH_ASSET,
      TestConstants.USD_ASSET
    ]);
  });

  it('should get current account value in fiat (counter_asset)', () => {
    const price = {
      amount: '9876543', //  $98,765.43 USD
      asset: TestConstants.USD_ASSET
    };

    // Test for asset = BTC
    let balance = {
      amount: '12345678', // ₿1.2345678 BTC
      asset: TestConstants.BTC_ASSET
    };

    let accountValue = service.getAccountValue(price, balance);
    expect(accountValue).toEqual(12193.2619631154); // $12,193.26 USD

    // Test for asset = ETH
    balance = {
      amount: '1234567890000000000', // Ξ1.23456789 ETH
      asset: TestConstants.ETH_ASSET
    };

    accountValue = service.getAccountValue(price, balance);
    expect(accountValue).toEqual(121932.62852004268); // $121,932.63 USD
  });

  it('should get portfolio (all accounts, account values, asset models, and total value)', () => {
    service.getPortfolio().subscribe((portfolio) => {
      let portfolioBalance = 0;
      portfolio.accounts.forEach((account) => {
        portfolioBalance = portfolioBalance + account.value!;
      });
      expect(portfolio.accounts.length).toBe(2); // ETH and BTC
      expect(portfolio.balance).toEqual(portfolioBalance);
    });
  });

  it('should pass through errors on getPortfolio()', () => {
    // Set error on listPrices
    MockPricesService.listPrices.and.returnValue(error$);

    service.getPortfolio().subscribe((error) => {
      expect(error).toBeInstanceOf(Error);
    });

    // Reset
    MockPricesService.listPrices.and.returnValue(
      of(TestConstants.SYMBOL_PRICE_BANK_MODEL_ARRAY)
    );

    // Set error on listAccounts
    MockAccountsService.listAccounts.and.returnValue(error$);

    service.getPortfolio().subscribe((error) => {
      expect(error).toBeInstanceOf(Error);
    });
  });

  it('should get account details', () => {
    service
      .getAccountDetails(
        TestConstants.ACCOUNT_GUID,
        TestConstants.USD_ASSET.code
      )
      .subscribe((account) => {
        expect(account).toEqual(TestConstants.ACCOUNT_MODEL);
      });
  });

  it('should pass through errors on getAccountDetails()', () => {
    // Set error on listPrices
    MockPricesService.listPrices.and.returnValue(error$);

    service
      .getAccountDetails(
        TestConstants.ACCOUNT_GUID,
        TestConstants.USD_ASSET.code
      )
      .subscribe((error) => {
        expect(error).toBeInstanceOf(Error);
      });

    // Reset
    MockPricesService.listPrices.and.returnValue(
      of(TestConstants.SYMBOL_PRICE_BANK_MODEL_ARRAY)
    );

    // Set error on listAccounts
    MockAccountsService.listAccounts.and.returnValue(error$);

    service
      .getAccountDetails(
        TestConstants.ACCOUNT_GUID,
        TestConstants.USD_ASSET.code
      )
      .subscribe((error) => {
        expect(error).toBeInstanceOf(Error);
      });
  });
});
