import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';

// Horario típico: lun-vie 08-22, sáb 09-14, dom cerrado.
const HORARIO_STANDARD = {
    lunes:     { abre: "08:00", cierra: "22:00", abierto: true },
    martes:    { abre: "08:00", cierra: "22:00", abierto: true },
    miercoles: { abre: "08:00", cierra: "22:00", abierto: true },
    jueves:    { abre: "08:00", cierra: "22:00", abierto: true },
    viernes:   { abre: "08:00", cierra: "22:00", abierto: true },
    sabado:    { abre: "09:00", cierra: "14:00", abierto: true },
    domingo:   { abre: "00:00", cierra: "00:00", abierto: false },
};

// Gimnasios demo con direcciones reales de CABA y sus coordenadas.
const GYMS = [
    {
        id: "gym_demo_01",
        nombreGimnasio: "Iron Forge Palermo",
        razonSocial: "Iron Forge S.R.L.",
        cuit: "30-71234567-9",
        nombreResponsable: "Martín Aguirre",
        contacto: "11-4567-8901",
        descripcion: "Gimnasio de fuerza y acondicionamiento con equipamiento profesional y zona de peso libre.",
        direccion: "Av. Santa Fe 3253, Palermo, CABA",
        latitude: -34.5889,
        longitude: -58.4106,
        planGimnasio: "black",
        congestionDemo: 3,
        actividades: ["Musculación", "Crossfit", "Funcional", "Boxeo"],
        fotos: [
            "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800",
            "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=800",
        ],
        clases: [
            { actividad: "Crossfit",    dia: "lunes",     horaInicio: "08:00", horaFin: "09:00", cupo: 20 },
            { actividad: "Funcional",   dia: "miercoles", horaInicio: "19:00", horaFin: "20:00", cupo: 25 },
            { actividad: "Boxeo",       dia: "viernes",   horaInicio: "20:00", horaFin: "21:00", cupo: 15 },
        ],
    },
    {
        id: "gym_demo_02",
        nombreGimnasio: "SportFlow Belgrano",
        razonSocial: "SportFlow S.A.",
        cuit: "30-70987654-3",
        nombreResponsable: "Lucía Fernández",
        contacto: "11-4789-1234",
        descripcion: "Centro deportivo integral con clases grupales y salón de ciclismo indoor.",
        direccion: "Av. Cabildo 2230, Belgrano, CABA",
        latitude: -34.5612,
        longitude: -58.4564,
        planGimnasio: "platinum",
        congestionDemo: 2,
        actividades: ["Spinning", "Funcional", "Zumba", "Pilates"],
        fotos: [
            "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800",
            "https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=800",
        ],
        clases: [
            { actividad: "Spinning",  dia: "martes",  horaInicio: "10:00", horaFin: "11:00", cupo: 18 },
            { actividad: "Zumba",     dia: "jueves",  horaInicio: "18:00", horaFin: "19:00", cupo: 30 },
            { actividad: "Pilates",   dia: "sabado",  horaInicio: "10:00", horaFin: "11:00", cupo: 12 },
        ],
    },
    {
        id: "gym_demo_03",
        nombreGimnasio: "Zenith Fitness San Telmo",
        razonSocial: "Zenith Wellness S.R.L.",
        cuit: "30-71456789-1",
        nombreResponsable: "Diego Sosa",
        contacto: "11-4321-5678",
        descripcion: "Tu espacio para el bienestar físico y mental, con foco en disciplinas de bajo impacto.",
        direccion: "Defensa 855, San Telmo, CABA",
        latitude: -34.6201,
        longitude: -58.3715,
        planGimnasio: "classic",
        congestionDemo: 1,
        actividades: ["Yoga", "Pilates", "Stretching"],
        fotos: [
            "https://images.unsplash.com/photo-1599901860904-17e6ed7083a0?w=800",
            "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800",
        ],
        clases: [
            { actividad: "Yoga",       dia: "lunes",     horaInicio: "09:00", horaFin: "10:00", cupo: 20 },
            { actividad: "Pilates",    dia: "miercoles", horaInicio: "18:00", horaFin: "19:00", cupo: 15 },
            { actividad: "Stretching", dia: "viernes",   horaInicio: "17:00", horaFin: "18:00", cupo: 20 },
        ],
    },
    {
        id: "gym_demo_04",
        nombreGimnasio: "PowerHouse Caballito",
        razonSocial: "PowerHouse Fitness S.A.",
        cuit: "30-70654321-7",
        nombreResponsable: "Carolina Méndez",
        contacto: "11-4654-9870",
        descripcion: "Gimnasio de alto rendimiento con musculación, crossfit y salón de spinning.",
        direccion: "Av. Rivadavia 5100, Caballito, CABA",
        latitude: -34.6178,
        longitude: -58.4389,
        planGimnasio: "platinum",
        congestionDemo: 3,
        actividades: ["Musculación", "Crossfit", "Spinning"],
        fotos: [
            "https://images.unsplash.com/photo-1534258936925-c58bed479fcb?w=800",
            "https://images.unsplash.com/photo-1546483875-ad9014c88eba?w=800",
        ],
        clases: [
            { actividad: "Crossfit",  dia: "martes",    horaInicio: "08:00", horaFin: "09:00", cupo: 22 },
            { actividad: "Spinning",  dia: "jueves",    horaInicio: "19:00", horaFin: "20:00", cupo: 18 },
        ],
    },
    {
        id: "gym_demo_05",
        nombreGimnasio: "Aurora Wellness Recoleta",
        razonSocial: "Aurora Wellness S.R.L.",
        cuit: "30-71789012-4",
        nombreResponsable: "Federico Ramos",
        contacto: "11-4812-3456",
        descripcion: "Club premium con pileta climatizada, clases grupales y espacio de relajación.",
        direccion: "Av. Callao 1200, Recoleta, CABA",
        latitude: -34.5959,
        longitude: -58.3925,
        planGimnasio: "black",
        congestionDemo: 2,
        actividades: ["Yoga", "Pilates", "Natación", "Funcional"],
        fotos: [
            "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800",
            "https://images.unsplash.com/photo-1574680178050-55c6a6a96e0a?w=800",
        ],
        clases: [
            { actividad: "Natación",  dia: "lunes",     horaInicio: "07:00", horaFin: "08:00", cupo: 12 },
            { actividad: "Yoga",      dia: "miercoles", horaInicio: "10:00", horaFin: "11:00", cupo: 20 },
            { actividad: "Funcional", dia: "viernes",   horaInicio: "19:00", horaFin: "20:00", cupo: 25 },
        ],
    },
];

// Pool de reseñas realistas. A cada gimnasio se le asigna un subconjunto
// distinto (rotando) para que no se repitan las mismas en todos.
const RESENAS_POOL = [
    { nombreUsuario: "Juan Pérez",      emailUsuario: "juan.perez@demo.com",      rating: 5, comentario: "Instalaciones impecables y los profes muy atentos. Lo recomiendo.", plan: "Black" },
    { nombreUsuario: "María Gómez",     emailUsuario: "maria.gomez@demo.com",     rating: 4, comentario: "Muy buen gimnasio, aunque en horario pico cuesta conseguir máquina.", plan: "Platinum" },
    { nombreUsuario: "Carlos Díaz",     emailUsuario: "carlos.diaz@demo.com",     rating: 5, comentario: "Horarios amplios, ideal para entrenar después del trabajo.", plan: "Classic" },
    { nombreUsuario: "Sofía Romero",    emailUsuario: "sofia.romero@demo.com",    rating: 3, comentario: "Cumple, pero los vestuarios podrían estar más limpios.", plan: "Platinum" },
    { nombreUsuario: "Tomás Ledesma",   emailUsuario: "tomas.ledesma@demo.com",   rating: 4, comentario: "Buena relación precio-calidad y variedad de clases.", plan: "Classic" },
    { nombreUsuario: "Valentina Ruiz",  emailUsuario: "valentina.ruiz@demo.com",  rating: 5, comentario: "Las clases grupales son excelentes y los profesores muy capacitados.", plan: "Black" },
    { nombreUsuario: "Nicolás Vera",    emailUsuario: "nicolas.vera@demo.com",    rating: 2, comentario: "Buen equipamiento pero suele estar muy lleno a la tarde.", plan: "Platinum" },
    { nombreUsuario: "Camila Suárez",   emailUsuario: "camila.suarez@demo.com",   rating: 4, comentario: "Ambiente copado y muy buena atención del personal.", plan: "Classic" },
];

// Devuelve 3 reseñas distintas para el gym en la posición `indice`.
const resenasParaGym = (indice) => {
    const out = [];
    for (let k = 0; k < 3; k++) {
        out.push(RESENAS_POOL[(indice + k) % RESENAS_POOL.length]);
    }
    return out;
};

export const ejecutarSeeding = async () => {
    try {
        for (let g = 0; g < GYMS.length; g++) {
            const { id, clases, ...gymData } = GYMS[g];
            const gymRef = doc(db, 'gimnasios', id);

            // setDoc con ID fijo para no duplicar en re-ejecuciones.
            await setDoc(gymRef, {
                ...gymData,
                duenioId: id,
                horarios: HORARIO_STANDARD,
                createdAt: serverTimestamp(),
            });

            // Clases (IDs deterministas para idempotencia).
            for (let i = 0; i < clases.length; i++) {
                await setDoc(doc(db, 'gimnasios', id, 'clases', `clase_${i + 1}`), {
                    ...clases[i],
                    createdAt: serverTimestamp(),
                });
            }

            // Reseñas distintas por gimnasio (IDs deterministas).
            const resenas = resenasParaGym(g);
            for (let i = 0; i < resenas.length; i++) {
                await setDoc(doc(db, 'gimnasios', id, 'resenas', `resena_demo_${i + 1}`), {
                    ...resenas[i],
                    fecha: serverTimestamp(),
                });
            }
        }

        // Empleador B2B de prueba (con plan pagado y vigente para poder cargar nómina).
        const empleadorId = "empresa_demo_tech";
        const empleadorRef = doc(db, 'empleadores', empleadorId);
        const vence = new Date();
        vence.setMonth(vence.getMonth() + 1);

        await setDoc(empleadorRef, {
            nombreEmpresa: "TechSolutions Argentina",
            razonSocial: "TechSolutions Argentina S.A.",
            cuit: "30-71555444-2",
            direccion: "Av. del Libertador 5800, Núñez, CABA",
            planTipo: "Platinum",
            planPeriodo: "mensual",
            cuposTotales: 30,
            cuposUsados: 2,
            planPagado: true,
            planVence: vence,
            createdAt: serverTimestamp(),
        });

        // Nómina del empleador (IDs deterministas).
        const nomina = [
            { email: "empleado1@tech.com", estado: "activo" },
            { email: "empleado2@tech.com", estado: "activo" },
        ];
        for (let i = 0; i < nomina.length; i++) {
            await setDoc(doc(empleadorRef, 'nomina', `empleado_demo_${i + 1}`), {
                ...nomina[i],
                createdAt: serverTimestamp(),
            });
        }

        return true;
    } catch (error) {
        console.error("Error ejecutando seeding de base de datos:", error);
        return false;
    }
};
