// Static Export를 위한 Dynamic Route 처리
// Server Component로 유지하면서 generateStaticParams() export
// 실제 UI는 Client Component에서 처리

import SeatsClient from './seats-client';

// Static Export 호환: 더미 페이지 1개 생성 → 나머지는 CloudFront fallback → CSR로 처리
export function generateStaticParams() {
    return [{ id: '_placeholder' }];
}

export default function SeatsPage() {
    return <SeatsClient />;
}
