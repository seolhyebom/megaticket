// Static Export를 위한 Dynamic Route 처리
// dynamicParams = false로 Static Export 호환
export const dynamicParams = false;

export default function SeatsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
