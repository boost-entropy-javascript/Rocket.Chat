import { IUActionButtonWhen, IUIActionButton } from '@rocket.chat/apps-engine/definition/ui/IUIActionButtonDescriptor';
import { ReactiveVar } from 'meteor/reactive-var';
import { Tracker } from 'meteor/tracker';
import { Meteor } from 'meteor/meteor';
import { FlowRouter, Router } from 'meteor/kadira:flow-router';
import { Session } from 'meteor/session';

import { SideNav } from './SideNav';
import { appLayout } from '../../../../client/lib/appLayout';
import { applyDropdownActionButtonFilters } from '../../../ui-message/client/actionButtons/lib/applyButtonFilters';

export interface IAccountBoxItem extends Omit<IUIActionButton, 'when'> {
	name: string;
	icon?: string;
	href?: string;
	sideNav?: string;
	isAppButtonItem?: boolean;
	subItems?: [IAccountBoxItem];
	when?: Omit<IUActionButtonWhen, 'roomTypes' | 'messageActionContext'>;
}

export class AccountBoxBase {
	private items = new ReactiveVar([]);

	private status = 0;

	public setStatus(status: number, statusText: string): any {
		return Meteor.call('setUserStatus', status, statusText);
	}

	public open(): void {
		if (SideNav.flexStatus()) {
			SideNav.closeFlex();
			return;
		}
		this.status = 1;
	}

	public close(): void {
		this.status = 0;
	}

	public toggle(): Window | null | void {
		if (this.status) {
			return this.close();
		}
		return this.open();
	}

	public openFlex(): void {
		this.status = 0;
	}

	public async addItem(newItem: IAccountBoxItem): Promise<void> {
		Tracker.nonreactive(() => {
			const actual = this.items.get();
			actual.push(newItem as never);
			this.items.set(actual);
		});
	}

	public async deleteItem(item: IAccountBoxItem): Promise<void> {
		Tracker.nonreactive(() => {
			const actual = this.items.get();
			const itemIndex = actual.findIndex((actualItem: IAccountBoxItem) => actualItem.appId === item.appId);
			actual.splice(itemIndex, 1);
			this.items.set(actual);
		});
	}

	public getItems(): IAccountBoxItem[] {
		return this.items.get().filter((item: IAccountBoxItem) => applyDropdownActionButtonFilters(item));
	}

	public addRoute(newRoute: any, router: any, wait = async (): Promise<null> => null): Router {
		if (router == null) {
			router = FlowRouter;
		}
		const container = newRoute.customContainer ? 'pageCustomContainer' : 'pageContainer';
		const routeConfig = {
			center: container,
			pageTemplate: newRoute.pageTemplate,
			i18nPageTitle: '',
			pageTitle: '',
		};

		if (newRoute.i18nPageTitle != null) {
			routeConfig.i18nPageTitle = newRoute.i18nPageTitle;
		}

		if (newRoute.pageTitle != null) {
			routeConfig.pageTitle = newRoute.pageTitle;
		}

		return router.route(newRoute.path, {
			name: newRoute.name,
			async action() {
				await wait();
				Session.set('openedRoom', null);
				appLayout.renderMainLayout(routeConfig);
			},
			triggersEnter: [
				(): void => {
					if (newRoute.sideNav != null) {
						SideNav.setFlex(newRoute.sideNav);
						SideNav.openFlex();
					}
				},
			],
		});
	}
}

export const AccountBox = new AccountBoxBase();
