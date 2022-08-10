import {
  AfterContentInit,
  Component,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';
import { ActivatedRoute, NavigationExtras } from '@angular/router';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';

import {
  BehaviorSubject,
  catchError,
  map,
  of,
  Subject,
  switchMap,
  take,
  takeUntil,
  timer
} from 'rxjs';

// Client
import { TradeBankModel, TradesService } from '@cybrid/cybrid-api-bank-angular';

// Services
import {
  Account,
  AccountService,
  Asset,
  AssetService,
  CODE,
  ComponentConfig,
  ConfigService,
  ErrorService,
  EventService,
  LEVEL,
  RoutingData,
  RoutingService
} from '@services';

// Utility
import { Constants } from '@constants';
import { symbolBuild } from '@utility';

@Component({
  selector: 'app-account-details',
  templateUrl: './account-details.component.html',
  styleUrls: ['./account-details.component.scss']
})
export class AccountDetailsComponent
  implements OnInit, AfterContentInit, OnDestroy
{
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
  dataSource: MatTableDataSource<TradeBankModel> = new MatTableDataSource();

  accountGuid: string = '';
  account$ = new BehaviorSubject<Account | null>(null);

  asset: Asset = Constants.BTC_ASSET;
  counterAssetCode = Constants.USD_ASSET.code;

  displayedColumns: string[] = ['transaction', 'balance'];
  getTradesError = false;
  isLoadingResults = true;

  totalRows = 0;
  pageSize = 5;
  currentPage = 0;
  pageSizeOptions: number[] = [5, 10, 25, 100];

  isLoading$ = new BehaviorSubject(true);
  isRecoverable$ = new BehaviorSubject(true);
  private unsubscribe$ = new Subject();

  routingData: RoutingData = {
    route: 'account-list',
    origin: 'account-detail'
  };

  constructor(
    public configService: ConfigService,
    private errorService: ErrorService,
    private eventService: EventService,
    private accountService: AccountService,
    private tradeService: TradesService,
    private assetService: AssetService,
    private route: ActivatedRoute,
    private routingService: RoutingService
  ) {}

  ngOnInit() {
    this.eventService.handleEvent(
      LEVEL.INFO,
      CODE.COMPONENT_INIT,
      'Initializing account-detail component'
    );
    this.getAccount();
    this.refreshData();
  }

  ngAfterContentInit() {
    this.dataSource.paginator = this.paginator;

    this.dataSource.sortingDataAccessor = this.sortingDataAccessor;
    this.dataSource.sort = this.sort;

    this.getTrades();
  }

  ngOnDestroy(): void {
    this.unsubscribe$.next('');
    this.unsubscribe$.complete();
  }

  getAccount() {
    // Set currently selected account based on routing data, for instance from an account-list row click
    this.route.queryParams
      .pipe(
        take(1),
        map((params) => {
          if (params) {
            this.accountGuid = params['accountGuid'];
          }
        })
      )
      .subscribe();

    this.configService
      .getConfig$()
      .pipe(
        map((config) => {
          this.counterAssetCode = config.fiat;
          return config.fiat;
        }),
        switchMap((counterAsset) => {
          return this.accountService
            .getAccountDetails(this.accountGuid, counterAsset)
            .pipe(
              map((account) => {
                this.asset = account.asset;
                this.account$.next(account);
                this.isLoading$.next(false);

                this.eventService.handleEvent(
                  LEVEL.INFO,
                  CODE.DATA_REFRESHED,
                  'Account details successfully updated'
                );
              }),
              catchError((err) => {
                this.eventService.handleEvent(
                  LEVEL.ERROR,
                  CODE.DATA_ERROR,
                  'There was an error fetching account details'
                );

                this.errorService.handleError(
                  new Error('There was an error fetching account details')
                );

                this.dataSource.data = [];
                this.getTradesError = true;
                return of(err);
              })
            );
        })
      )
      .subscribe();
  }

  getTrades(): void {
    this.isLoadingResults = true;

    this.tradeService
      .listTrades(
        this.currentPage.toString(),
        this.pageSize.toString(),
        '',
        '',
        '',
        this.accountGuid
      )
      .pipe(
        map((trades) => {
          this.dataSource.data = trades.objects;

          this.paginator.pageIndex = this.currentPage;
          this.paginator.length = Number(trades.total);

          this.isLoadingResults = false;
        }),
        catchError((err) => {
          this.eventService.handleEvent(
            LEVEL.ERROR,
            CODE.DATA_ERROR,
            'There was an error fetching trades'
          );

          this.errorService.handleError(
            new Error('There was an error fetching trades')
          );
          return of(err);
        })
      )
      .subscribe();
  }

  pageChange(event: PageEvent): void {
    this.pageSize = event.pageSize;
    this.currentPage = event.pageIndex;

    this.getTrades();
  }

  sortChange(): void {
    this.dataSource.sort = this.sort;
  }

  refreshData(): void {
    this.configService
      .getConfig$()
      .pipe(
        switchMap((cfg: ComponentConfig) => {
          return timer(cfg.refreshInterval, cfg.refreshInterval);
        }),
        takeUntil(this.unsubscribe$)
      )
      .subscribe({
        next: () => {
          this.eventService.handleEvent(
            LEVEL.INFO,
            CODE.DATA_FETCHING,
            'Refreshing account details...'
          );
          this.getAccount();
          this.getTrades();
        }
      });
  }

  sortingDataAccessor(trade: TradeBankModel, columnDef: string) {
    switch (columnDef) {
      case 'transaction':
        return trade.created_at!;
      case 'balance':
        return trade.side! == 'buy'
          ? trade.receive_amount!
          : trade.deliver_amount!;
      default:
        return '';
    }
  }

  onTrade(): void {
    const extras: NavigationExtras = {
      queryParams: {
        asset: JSON.stringify(this.asset),
        symbol_pair: symbolBuild(this.asset.code, this.counterAssetCode)
      }
    };
    this.routingService.handleRoute({
      origin: 'account-detail',
      route: 'trade',
      extras: extras
    });
  }
}
