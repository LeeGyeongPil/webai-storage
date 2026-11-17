# 보안 정책 / Security policy

보안 취약점을 발견하셨다면 **공개 이슈 대신** 이 레포의 **Security → Report a vulnerability**(비공개 취약점 신고)로 알려 주세요. 확인 후 답변드리고, 고친 버전을 릴리스하면서 함께 안내합니다.

If you find a security issue, please **do not open a public issue**. Use **Security → Report a vulnerability** in this repository to report it privately. We will reply after checking and announce the fix with a release.

이 라이브러리는 서버가 없고, `fetchHfFileSizes` 에 넘긴 호스트 외에는 네트워크 호출을 하지 않으며, `removeModel`/`clearAll` 을 호출할 때 해당 출처(origin) 자신의 저장소만 지웁니다. / This library has no server, makes no network calls except `fetchHfFileSizes` to the host you pass, and deletes only the calling origin's own storage when you call `removeModel` / `clearAll`.
