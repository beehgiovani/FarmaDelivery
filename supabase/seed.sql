INSERT INTO
    "Store" (
        "id",
        "code",
        "name",
        "address",
        "latitude",
        "longitude",
        "baseType",
        "active",
        "createdAt",
        "updatedAt"
    )
VALUES
    (
        gen_random_uuid (),
        'LOJA_1',
        'Asturias',
        'Av. dos Caicaras, 1171 - Asturias',
        -24.0038254,
        -46.2739040,
        'COMPARTILHADA',
        true,
        now (),
        now ()
    ),
    (
        gen_random_uuid (),
        'LOJA_2',
        'Morrinhos',
        'Rua Poeta Augusto Frederico Schimidt, 10 - Jardim Brasil, Morrinhos',
        -23.9641688,
        -46.2487743,
        'COMPARTILHADA',
        true,
        now (),
        now ()
    ),
    (
        gen_random_uuid (),
        'LOJA_3',
        'Santa Rosa',
        'Rua Jose Vaz Porto, 588 - proximo a Praca do Povo, Santa Rosa',
        -23.9971092,
        -46.2814548,
        'COMPARTILHADA',
        true,
        now (),
        now ()
    ),
    (
        gen_random_uuid (),
        'LOJA_4',
        'Santo Antonio',
        'Alameda das Tulipas, 660 - Santo Antonio',
        -23.9886659,
        -46.2719188,
        'COMPARTILHADA',
        true,
        now (),
        now ()
    ),
    (
        gen_random_uuid (),
        'LOJA_5',
        'Pereque',
        'Av. Rio Amazonas, 151 - Praia do Pereque, Pereque',
        -23.9366571,
        -46.1831768,
        'DEDICADA',
        true,
        now (),
        now ()
    ) ON CONFLICT ("code") DO
UPDATE
SET
    "name" = EXCLUDED."name",
    "address" = EXCLUDED."address",
    "latitude" = EXCLUDED."latitude",
    "longitude" = EXCLUDED."longitude",
    "baseType" = EXCLUDED."baseType",
    "active" = EXCLUDED."active",
    "updatedAt" = now ();