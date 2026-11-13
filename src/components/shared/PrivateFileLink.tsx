import { useSecureUrl } from '@/hooks/useSecureUrl';
import { getBucketFromUrl } from '@/utils/signedUrlUtils';
export function PrivateFileLink({path,children,className,label}:{path:string;children:React.ReactNode;className?:string;label?:string}) {
  const {url}=useSecureUrl(getBucketFromUrl(path)||'application-files',path);
  return url?<a href={url} target="_blank" rel="noopener noreferrer" className={className} aria-label={label}>{children}</a>:null;
}