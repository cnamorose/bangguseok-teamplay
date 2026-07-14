import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest){

    try{
        const {email, password, name} = await req.json();


        // 1. 입력값 기본 검증
        if (!email || !password){
            return NextResponse.json(
                {error: "이메일과 비밀번호는 필수입니다."},
                {status: 400}
            );
        }

        //2. 이미 가입된 이메일인지 확인
        const existingUser = await prisma.user.findUnique({
            where:{email},
        });

        if(existingUser){
            return NextResponse.json(
                {error: "이미 사용 중인 이메일입니다."},
                {status: 409}
            );
        }

        // 3. 비밀번호 해싱 (평문 저장 금지)
        const hashedPassword = await bcrypt.hash(password, 10);

        // 4. DB에 유저 저장
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name: name || null,
            },
        });


        // 5. 응답 (비밀번호는 절대 응답에 포함 안 함)
        return NextResponse.json(
            {
                message: "회원가입 성공",
                user: {id: user.id, email: user.email, name: user.name},
            },
            {status: 200}
        );
    } catch (error) {
        console.error("회원가입 에러:", error);
        return NextResponse.json(
            {error: "서버 오류가 발생했습니다."},
            {status: 500}
        );
    }
}