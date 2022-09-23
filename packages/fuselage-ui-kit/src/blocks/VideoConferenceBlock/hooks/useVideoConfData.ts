import { useQuery } from '@tanstack/react-query';
import { useEndpoint } from '@rocket.chat/ui-contexts';

export const useVideoConfData = ({ callId }: { callId: string }) => {
  const videoConf = useEndpoint('GET', '/v1/video-conference.info');

  return useQuery(['video-conference', callId], () => videoConf({ callId }), {
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    // refetchOnMount: false,
  });
};
