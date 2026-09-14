import { SUPPORT_EMAIL } from "@/lib/constants";

// 법률 자문이 아닌 초안입니다 - 실제 서비스 운영 전 직접(또는 법률 전문가의)
// 검토가 필요합니다. 확정적인 법적 보증·포괄 면책 표현("어떤 경우에도 책임지지
// 않습니다" 식)은 쓰지 않고, 서비스가 실제로 하는 일과 하지 않는 일을 사실
// 위주로 적었습니다.
export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <h1 className="text-2xl font-bold">이용약관</h1>
      <p className="mt-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        이 약관은 &quot;툴허브&quot;(이하 &quot;서비스&quot;) 이용에 관한 기본적인 사항을 안내합니다. 이
        문서는 법률 자문이 아니며, 서비스 운영자가 직접 검토·보완할 예정인 초안입니다.
      </p>

      <div className="mt-10 flex flex-col gap-10">
        <section>
          <h2 className="text-lg font-semibold">1. 서비스의 성격</h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            툴허브는 자동화 툴(봇·스크립트)을 필요로 하는 사람과 만들 수 있는 사람을 연결하는 게시·중개
            서비스입니다. 의뢰 등록, 제안, 매물 게시, 거래 당사자 간 연락처·계좌 정보 확인 등을
            지원하지만, 거래 자체는 이용자 간 직거래이며 서비스가 대금을 예치·보관하지 않습니다. 서비스는
            거래의 당사자가 아니라 두 이용자를 연결하는 게시판 역할을 합니다.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">2. 책임의 범위</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            <li>
              완성본과 매물에 대해 제공되는 자동 보안 스캔은 정해진 규칙에 따라 대표적인 위험 패턴을
              탐지하는 자동화된 검사입니다. 사람이 직접 코드를 검토하지 않으며, 스캔에서 문제가
              발견되지 않았다고 해서 코드에 위험이 전혀 없다는 것을 보장하지 않습니다.
            </li>
            <li>
              서비스는 완성본·매물의 기능적 품질(요구사항 충족 여부, 성능, 유지보수 가능성 등)을
              검증하지 않습니다. 기능 적합성 판단은 의뢰자·구매자 본인의 확인에 달려 있습니다.
            </li>
            <li>
              이용자 간 직거래 과정에서 발생하는 분쟁(대금 미지급, 완성본 미제공, 품질 이견 등)은
              1차적으로 당사자 간 협의로 해결하는 것을 원칙으로 합니다.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">3. 결제와 환불</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            <li>결제는 서비스를 거치지 않고 이용자 간 계좌 이체로 직접 이루어집니다.</li>
            <li>
              완성본을 다운로드한 이후에는 이미 결과물이 전달된 상태이므로 환불이 어렵습니다. 다운로드
              전에 스캔 결과와 매물 설명을 충분히 확인해주세요.
            </li>
            <li>
              환불이나 결제 관련 분쟁이 발생하면 우선 거래 당사자 간 협의로 해결해주세요. 서비스는
              대금을 보관하지 않으므로 결제를 대신 취소·환불 처리할 수 없습니다.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">4. 금지 행위</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            <li>악성코드, 타인의 시스템을 무단으로 침해하는 코드를 제작·유포하는 행위</li>
            <li>타인의 개인정보·금융정보를 무단으로 수집·유출하는 용도의 자동화 툴을 의뢰·제작·판매하는 행위</li>
            <li>저작권 등 타인의 지식재산권을 침해하는 코드를 등록하는 행위</li>
            <li>허위 매물 등록, 허위 신고, 서비스 운영을 방해하는 행위</li>
            <li>다른 이용자에게 위협·비방·부적절한 내용을 전달하는 행위</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">5. 개인정보 처리 범위</h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            계좌 정보 등 금융정보는 거래 당사자(해당 거래의 구매자·판매자 또는 의뢰자·제작자)에게만
            공개되며, 그 외 제3자나 비로그인 방문자에게는 노출되지 않습니다. 자세한 수집·이용 항목은{" "}
            <a href="/privacy" className="font-medium text-accent underline underline-offset-2">
              개인정보처리방침
            </a>
            을 참고해주세요.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">6. 문의처</h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            서비스 이용 중 궁금한 점이나 신고할 내용이 있다면 아래 이메일로 연락해주세요.
          </p>
          <p className="mt-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">{SUPPORT_EMAIL}</p>
        </section>
      </div>
    </main>
  );
}
