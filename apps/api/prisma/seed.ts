import { PrismaClient, StoreBaseType } from "@prisma/client";

const prisma = new PrismaClient();

const stores = [
  {
    code: "LOJA_1",
    name: "Asturias",
    address: "Av. dos Caicaras, 1171 - Asturias",
    latitude: "-24.0038254",
    longitude: "-46.2739040",
    baseType: StoreBaseType.COMPARTILHADA,
  },
  {
    code: "LOJA_2",
    name: "Morrinhos",
    address: "Rua Poeta Augusto Frederico Schimidt, 10 - Jardim Brasil, Morrinhos",
    latitude: "-23.9641688",
    longitude: "-46.2487743",
    baseType: StoreBaseType.COMPARTILHADA,
  },
  {
    code: "LOJA_3",
    name: "Santa Rosa",
    address: "Rua Jose Vaz Porto, 588 - proximo a Praca do Povo, Santa Rosa",
    latitude: "-23.9971092",
    longitude: "-46.2814548",
    baseType: StoreBaseType.COMPARTILHADA,
  },
  {
    code: "LOJA_4",
    name: "Santo Antonio",
    address: "Alameda das Tulipas, 660 - Santo Antonio",
    latitude: "-23.9886659",
    longitude: "-46.2719188",
    baseType: StoreBaseType.COMPARTILHADA,
  },
  {
    code: "LOJA_5",
    name: "Pereque",
    address: "Av. Rio Amazonas, 151 - Praia do Pereque, Pereque",
    latitude: "-23.9366571",
    longitude: "-46.1831768",
    baseType: StoreBaseType.DEDICADA,
  },
];

async function main() {
  for (const store of stores) {
    await prisma.store.upsert({
      where: { code: store.code },
      update: store,
      create: store,
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
