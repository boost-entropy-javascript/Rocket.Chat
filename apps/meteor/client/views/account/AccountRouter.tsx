import { useRouter } from '@rocket.chat/ui-contexts';
import type { ReactElement, ReactNode } from 'react';
import React, { Suspense, useEffect } from 'react';

import PageSkeleton from '../../components/PageSkeleton';
import SidebarPortal from '../../sidebar/SidebarPortal';
import AccountSidebar from './AccountSidebar';

type AccountRouterProps = {
	children?: ReactNode;
};

const AccountRouter = ({ children }: AccountRouterProps): ReactElement => {
	const router = useRouter();

	useEffect(
		() =>
			router.subscribeToRouteChange(() => {
				if (router.getRouteName() !== 'account-index') {
					return;
				}

				router.navigate('/account/profile', { replace: true });
			}),
		[router],
	);

	return children ? (
		<>
			<Suspense fallback={<PageSkeleton />}>{children}</Suspense>
			<SidebarPortal>
				<AccountSidebar />
			</SidebarPortal>
		</>
	) : (
		<PageSkeleton />
	);
};

export default AccountRouter;
